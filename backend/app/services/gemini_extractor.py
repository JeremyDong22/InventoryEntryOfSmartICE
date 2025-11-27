# Gemini 结构化提取服务
# v1.2 - 将语音识别文本转换为采购清单 JSON
# 使用 Gemini 2.0 Flash 进行高速结构化提取 (1.5 系列已于 2025-04 退役)
# 修复: 花括号转义 + traceback 调试 + 安全响应访问

import os
import json
import traceback
import google.generativeai as genai
from typing import Optional

from app.models.voice_entry import VoiceEntryResult, ProcurementItem, EXTRACTION_SCHEMA


class GeminiExtractorService:
    """
    Gemini 结构化数据提取服务
    将语音识别的自然语言文本转换为结构化的采购清单 JSON
    """

    # 提取提示词模板
    # 注意: JSON 中的花括号需要双写 {{ }} 以转义 Python str.format()
    EXTRACTION_PROMPT = """你是一个专业的采购清单解析助手。请将用户的语音输入转换为结构化的采购清单 JSON。

## 输出格式要求
严格按照以下 JSON Schema 输出，不要添加任何额外字段或注释：

```json
{{
  "supplier": "供应商全称",
  "notes": "备注信息（如有）",
  "items": [
    {{
      "name": "商品名称",
      "specification": "规格/包装描述（如：带皮、黄心、500ml*12）",
      "quantity": 数量(数字),
      "unit": "单位",
      "unitPrice": 单价(数字),
      "total": 小计(数字)
    }}
  ]
}}
```

## 解析规则
1. **数量和单价**：必须是纯数字，不带单位
2. **小计计算**：total = quantity × unitPrice，必须自动计算
3. **单位标准化**：常见单位包括 斤、公斤、kg、箱、袋、桶、瓶、包、件、个
4. **供应商**：如果没有明确说明，设为空字符串 ""
5. **规格**：从描述中提取包装信息，如"去皮"、"带皮"、"黄心"、"500ml*12"等
6. **备注**：提取与商品无关的额外说明，如"品质不错"、"个头较小"等

## 四川方言/口语适配
- "块" = 元（货币单位）
- "一共xxx块" = 总价（用于验证计算）
- "斤" 在四川通常指 500g
- 数字可能是口语形式："一块二" = 1.2，"六十八" = 68

## 示例

输入: "供应商是双汇冷鲜肉直供，去皮五花肉30斤，68块一斤，一共2040块"
输出:
```json
{{
  "supplier": "双汇冷鲜肉直供",
  "notes": "",
  "items": [
    {{
      "name": "去皮五花肉",
      "specification": "去皮",
      "quantity": 30,
      "unit": "斤",
      "unitPrice": 68,
      "total": 2040
    }}
  ]
}}
```

输入: "城南蔬菜批发，本地土豆50斤，1块2一斤，青椒20斤，4块5一斤，土豆这批个头较小"
输出:
```json
{{
  "supplier": "城南蔬菜批发",
  "notes": "土豆这批个头较小",
  "items": [
    {{
      "name": "本地土豆",
      "specification": "",
      "quantity": 50,
      "unit": "斤",
      "unitPrice": 1.2,
      "total": 60
    }},
    {{
      "name": "青椒",
      "specification": "",
      "quantity": 20,
      "unit": "斤",
      "unitPrice": 4.5,
      "total": 90
    }}
  ]
}}
```

---

## 当前语音输入
{text}

请直接输出 JSON，不要包含任何解释或 markdown 代码块标记。"""

    def __init__(self):
        """
        初始化 Gemini 服务
        """
        api_key = os.getenv("GEMINI_API_KEY", "")

        if api_key:
            genai.configure(api_key=api_key)
            # 使用 Gemini 2.0 Flash - 稳定快速 (1.5 系列已于 2025-04 退役)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
            self.available = True
            print("[GeminiExtractor] 已配置 Gemini API (gemini-2.0-flash)")
        else:
            self.model = None
            self.available = False
            print("[GeminiExtractor] 警告: 未配置 GEMINI_API_KEY，将使用 Mock 模式")

    def _extract_json_from_response(self, text: str) -> dict:
        """
        从响应中提取 JSON，处理可能的 markdown 代码块
        """
        import re

        # 尝试直接解析
        try:
            return json.loads(text)
        except:
            pass

        # 尝试提取 ```json ... ``` 代码块
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except:
                pass

        # 尝试找到 { ... } 结构
        brace_match = re.search(r'\{.*\}', text, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except:
                pass

        raise json.JSONDecodeError("无法从响应中提取 JSON", text, 0)

    async def extract(self, text: str) -> VoiceEntryResult:
        """
        从语音识别文本提取结构化数据

        Args:
            text: ASR 识别的原始文本

        Returns:
            VoiceEntryResult: 结构化的采购清单
        """
        if not self.available or not text.strip():
            return await self._mock_extract(text)

        response = None
        try:
            prompt = self.EXTRACTION_PROMPT.format(text=text)

            # 调用 Gemini 2.0 Flash
            response = await self.model.generate_content_async(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,  # 低温度确保输出稳定
                )
            )

            # 安全获取响应文本
            response_text = None
            try:
                response_text = response.text
            except ValueError as ve:
                print(f"[GeminiExtractor] 获取响应失败: {ve}")
                return await self._mock_extract(text)

            if not response_text:
                return await self._mock_extract(text)

            # 解析 JSON 响应 (处理可能的 markdown 格式)
            result_json = self._extract_json_from_response(response_text)

            # 转换为 Pydantic 模型
            items = [
                ProcurementItem(
                    name=item.get("name", ""),
                    specification=item.get("specification", ""),
                    quantity=float(item.get("quantity", 0)),
                    unit=item.get("unit", ""),
                    unitPrice=float(item.get("unitPrice", 0)),
                    total=float(item.get("total", 0))
                )
                for item in result_json.get("items", [])
            ]

            print(f"[GeminiExtractor] 提取成功: {result_json.get('supplier')}, {len(items)} 项")
            return VoiceEntryResult(
                supplier=result_json.get("supplier", ""),
                notes=result_json.get("notes", ""),
                items=items
            )

        except json.JSONDecodeError as e:
            print(f"[GeminiExtractor] JSON 解析错误: {e}")
            return await self._mock_extract(text)

        except Exception as e:
            print(f"[GeminiExtractor] 提取错误: {type(e).__name__}: {e}")
            return await self._mock_extract(text)

    async def _mock_extract(self, text: str) -> VoiceEntryResult:
        """
        Mock 模式 - 用于演示和测试
        基于简单规则解析文本
        """
        # 简单的 Mock 返回
        if "五花肉" in text:
            return VoiceEntryResult(
                supplier="双汇冷鲜肉直供",
                notes="",
                items=[
                    ProcurementItem(
                        name="去皮五花肉",
                        specification="去皮",
                        quantity=30,
                        unit="斤",
                        unitPrice=68,
                        total=2040
                    )
                ]
            )
        elif "土豆" in text:
            return VoiceEntryResult(
                supplier="城南蔬菜批发",
                notes="土豆个头较小",
                items=[
                    ProcurementItem(
                        name="本地土豆",
                        specification="黄心",
                        quantity=50,
                        unit="斤",
                        unitPrice=1.2,
                        total=60
                    ),
                    ProcurementItem(
                        name="青椒",
                        specification="",
                        quantity=20,
                        unit="斤",
                        unitPrice=4.5,
                        total=90
                    )
                ]
            )
        else:
            return VoiceEntryResult(
                supplier="",
                notes=text,
                items=[]
            )


# 单例实例
gemini_extractor = GeminiExtractorService()
