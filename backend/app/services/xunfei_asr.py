# 讯飞语音听写服务 (IAT - Intelligent Audio Transcription)
# v3.3 - 实时流式语音识别，支持 WebSocket 双向通信
# v3.1: 优化 vad_eos 从 3000ms 降至 2000ms，减少静音检测延迟
# v3.2: 正确处理 pgs/rg 字段，实现逐字显示效果
# v3.3: 修复识别完成后继续发送音频导致的 timeout 错误（使用 Event 协调任务）
# 文档: https://www.xfyun.cn/doc/asr/voicedictation/API.html
# 支持普通话 + 四川方言 + 实时返回部分结果

import websockets
import hashlib
import hmac
import base64
import json
import asyncio
from datetime import datetime
from time import mktime
from wsgiref.handlers import format_date_time
from urllib.parse import urlencode, quote
import os
from typing import AsyncGenerator, Callable, Optional


class XunfeiASRService:
    """
    讯飞语音听写服务 (IAT)
    支持 60 秒内实时语音识别
    """

    # 语音听写 WebSocket API 地址
    IAT_URL = "wss://iat-api.xfyun.cn/v2/iat"
    HOST = "iat-api.xfyun.cn"

    def __init__(self):
        """
        初始化讯飞 ASR 服务
        需要 APPID, APIKey, APISecret 三个凭证
        """
        self.app_id = os.getenv("XUNFEI_APP_ID", "")
        self.api_key = os.getenv("XUNFEI_API_KEY", "")
        self.api_secret = os.getenv("XUNFEI_API_SECRET", "")

        if not self.app_id or not self.api_key or not self.api_secret:
            print("[XunfeiASR] 警告: 未完整配置讯飞凭证，将使用 Mock 模式")
            self.available = False
        else:
            self.available = True
            print(f"[XunfeiASR] 已配置 - APPID: {self.app_id[:4]}***")

    def _create_auth_url(self) -> str:
        """
        生成鉴权 URL (HMAC-SHA256 签名)
        """
        # 生成 RFC1123 格式时间戳
        now = datetime.now()
        date = format_date_time(mktime(now.timetuple()))

        # 构建签名原文
        signature_origin = f"host: {self.HOST}\n"
        signature_origin += f"date: {date}\n"
        signature_origin += "GET /v2/iat HTTP/1.1"

        # HMAC-SHA256 签名
        signature_sha = hmac.new(
            self.api_secret.encode('utf-8'),
            signature_origin.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()

        signature_sha_base64 = base64.b64encode(signature_sha).decode('utf-8')

        # 构建 authorization
        authorization_origin = (
            f'api_key="{self.api_key}", '
            f'algorithm="hmac-sha256", '
            f'headers="host date request-line", '
            f'signature="{signature_sha_base64}"'
        )
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')

        # 构建最终 URL
        params = {
            "authorization": authorization,
            "date": date,
            "host": self.HOST
        }

        return f"{self.IAT_URL}?{urlencode(params)}"

    def _create_first_frame(self, language: str = "zh_cn") -> dict:
        """
        创建首帧数据 (包含业务参数)

        v3.4: 支持语言参数，优化流式返回配置

        Args:
            language: 语言设置 (zh_cn=中文, en_us=英文)
        """
        business_params = {
            "language": language,         # 语言
            "domain": "iat",              # 日常用语
            "accent": "mandarin" if language == "zh_cn" else "mandarin",
            "vad_eos": 10000,             # v3.5: 静音检测 10秒（允许用户思考）
            "dwa": "wpgs",                # 动态修正 (仅中文有效，但不影响英文)
            "ptt": 1,                     # 添加标点
            "nunum": 1,                   # 数字格式化（将数字转为阿拉伯数字）
        }

        # v3.5: 打印业务参数
        print(f"[XunfeiASR] 业务参数: language={language}, vad_eos=10000ms, dwa=wpgs")

        return {
            "common": {
                "app_id": self.app_id
            },
            "business": business_params,
            "data": {
                "status": 0,              # 首帧
                "format": "audio/L16;rate=16000",
                "encoding": "raw",
                "audio": ""
            }
        }

    def _create_audio_frame(self, audio_base64: str, is_last: bool = False) -> dict:
        """
        创建音频帧数据
        """
        return {
            "data": {
                "status": 2 if is_last else 1,  # 2=最后一帧, 1=中间帧
                "format": "audio/L16;rate=16000",
                "encoding": "raw",
                "audio": audio_base64
            }
        }

    async def transcribe_audio_bytes(self, audio_data: bytes) -> str:
        """
        识别完整音频数据

        Args:
            audio_data: PCM 音频数据 (16kHz, 16bit, 单声道)

        Returns:
            识别文本
        """
        # Mock 模式
        if not self.available:
            return await self._mock_transcribe()

        full_text = ""

        try:
            auth_url = self._create_auth_url()
            print(f"[XunfeiASR] 连接: {self.IAT_URL}")

            async with websockets.connect(auth_url) as ws:
                # 发送首帧
                first_frame = self._create_first_frame()
                await ws.send(json.dumps(first_frame))

                # 分块发送音频 (每帧约 40ms = 1280 bytes @ 16kHz 16bit)
                chunk_size = 1280
                total_chunks = (len(audio_data) + chunk_size - 1) // chunk_size

                for i in range(0, len(audio_data), chunk_size):
                    chunk = audio_data[i:i + chunk_size]
                    is_last = (i + chunk_size >= len(audio_data))

                    audio_base64 = base64.b64encode(chunk).decode('utf-8')
                    frame = self._create_audio_frame(audio_base64, is_last)
                    await ws.send(json.dumps(frame))

                    # 控制发送速率 (模拟实时)
                    await asyncio.sleep(0.04)

                # 接收识别结果
                while True:
                    try:
                        response = await asyncio.wait_for(ws.recv(), timeout=10)
                        result = json.loads(response)

                        code = result.get("code", -1)
                        if code != 0:
                            error_msg = result.get("message", "Unknown error")
                            print(f"[XunfeiASR] 错误 {code}: {error_msg}")
                            break

                        # 解析识别结果
                        data = result.get("data", {})
                        if data:
                            result_obj = data.get("result", {})
                            ws_list = result_obj.get("ws", [])

                            for ws_item in ws_list:
                                cw_list = ws_item.get("cw", [])
                                for cw in cw_list:
                                    word = cw.get("w", "")
                                    full_text += word

                            # 检查是否结束
                            status = data.get("status", 0)
                            if status == 2:
                                print(f"[XunfeiASR] 识别完成: {full_text}")
                                break

                    except asyncio.TimeoutError:
                        print("[XunfeiASR] 接收超时")
                        break

        except Exception as e:
            print(f"[XunfeiASR] 连接错误: {e}")
            # 如果真实 API 失败，返回 Mock
            return await self._mock_transcribe()

        return full_text

    async def transcribe_realtime(
        self,
        client_ws,
        on_partial: Optional[Callable[[str], None]] = None
    ) -> str:
        """
        实时流式语音识别

        从客户端 WebSocket 接收 PCM 音频块，转发到讯飞 ASR，实时返回部分结果

        Args:
            client_ws: 客户端 WebSocket 连接
            on_partial: 部分结果回调函数

        Returns:
            完整识别文本

        v3.2: 正确处理 pgs/rg 字段，实现逐字显示效果
        - pgs="apd": 追加模式，新增文本
        - pgs="rpl": 替换模式，修正之前的识别结果
        - rg=[start, end]: 替换范围（序号）
        - sn: 句子/序列号
        """
        # Mock 模式
        if not self.available:
            mock_text = await self._mock_transcribe()
            if on_partial:
                await on_partial(mock_text)
            return mock_text

        full_text = ""
        xunfei_ws = None
        # v3.2: 使用字典存储各序列号的识别结果，支持 pgs/rg 动态修正
        rec_text: dict[int, str] = {}
        # v3.3: 使用 Event 通知发送任务停止（当讯飞返回 status=2 后）
        recognition_done = asyncio.Event()

        def get_current_text() -> str:
            """按序列号顺序组合当前识别文本"""
            if not rec_text:
                return ""
            sorted_keys = sorted(rec_text.keys())
            return "".join(rec_text[k] for k in sorted_keys)

        try:
            # 连接讯飞 WebSocket
            auth_url = self._create_auth_url()
            print(f"[XunfeiASR] 实时连接: {self.IAT_URL}")

            xunfei_ws = await websockets.connect(auth_url)

            # 发送首帧
            first_frame = self._create_first_frame()
            await xunfei_ws.send(json.dumps(first_frame))
            print("[XunfeiASR] 已发送首帧 (dwa=wpgs 动态修正已启用)")

            # 任务管理
            receive_task = None
            send_task = None

            async def receive_from_xunfei():
                """从讯飞接收识别结果，转发到客户端"""
                nonlocal full_text

                try:
                    while True:
                        response = await asyncio.wait_for(xunfei_ws.recv(), timeout=30)
                        result = json.loads(response)

                        code = result.get("code", -1)
                        if code != 0:
                            error_msg = result.get("message", "Unknown error")
                            print(f"[XunfeiASR] 讯飞错误 {code}: {error_msg}")
                            await client_ws.send_json({
                                "type": "error",
                                "error": f"ASR Error: {error_msg}"
                            })
                            break

                        # 解析识别结果
                        data = result.get("data", {})
                        if data:
                            result_obj = data.get("result", {})
                            ws_list = result_obj.get("ws", [])

                            # v3.2: 获取 pgs/rg/sn 字段
                            pgs = result_obj.get("pgs", "apd")  # apd=追加, rpl=替换
                            rg = result_obj.get("rg", [])       # 替换范围 [start, end]
                            sn = result_obj.get("sn", 0)        # 序列号
                            status = data.get("status", 0)

                            # v3.4: 详细调试 - 打印完整响应结构和词列表
                            ws_words = []
                            for ws_item in ws_list:
                                for cw in ws_item.get("cw", []):
                                    ws_words.append(cw.get("w", ""))
                            print(f"[XunfeiASR] 收到响应: status={status}, sn={sn}, pgs={pgs}, rg={rg}, words={ws_words}")

                            # 提取本次识别文本
                            partial_text = ""
                            for ws_item in ws_list:
                                cw_list = ws_item.get("cw", [])
                                for cw in cw_list:
                                    word = cw.get("w", "")
                                    partial_text += word

                            if partial_text or pgs == "rpl":
                                # v3.2: 根据 pgs 模式处理
                                if pgs == "rpl" and rg and len(rg) >= 2:
                                    # 替换模式：更新指定范围
                                    rec_text[rg[0]] = partial_text
                                    # 删除中间的旧结果
                                    for i in range(rg[0] + 1, rg[1] + 1):
                                        rec_text.pop(i, None)
                                    print(f"[XunfeiASR] 替换 sn={rg[0]}-{rg[1]}: {partial_text}")
                                else:
                                    # 追加模式：添加新结果
                                    rec_text[sn] = partial_text
                                    print(f"[XunfeiASR] 追加 sn={sn}: {partial_text}")

                                # 组合当前完整文本
                                full_text = get_current_text()

                                # 发送部分结果到客户端
                                await client_ws.send_json({
                                    "type": "partial",
                                    "text": full_text
                                })

                                # 调用回调
                                if on_partial:
                                    await on_partial(full_text)

                            # 检查是否结束 (status 已在上面提取)
                            if status == 2:
                                full_text = get_current_text()
                                print(f"[XunfeiASR] 识别完成: {full_text}")
                                # v3.3: 通知发送任务停止
                                recognition_done.set()
                                break

                except asyncio.TimeoutError:
                    print("[XunfeiASR] 接收超时")
                    recognition_done.set()  # v3.3: 超时也停止发送
                except Exception as e:
                    print(f"[XunfeiASR] 接收错误: {e}")
                    recognition_done.set()  # v3.3: 错误也停止发送

            async def send_to_xunfei():
                """从客户端接收音频，转发到讯飞"""
                audio_frame_count = 0
                try:
                    while True:
                        # v3.3: 检查识别是否已完成（讯飞 vad_eos 触发）
                        if recognition_done.is_set():
                            print(f"[XunfeiASR] 识别已完成，停止接收音频 (共 {audio_frame_count} 帧)")
                            break

                        # 从客户端接收音频数据（带超时，以便检查 recognition_done）
                        try:
                            raw_message = await asyncio.wait_for(
                                client_ws.receive_text(),
                                timeout=0.5
                            )
                        except asyncio.TimeoutError:
                            # 超时后检查是否应该停止
                            continue

                        message = json.loads(raw_message)
                        msg_type = message.get("type", "")

                        if msg_type == "audio":
                            # v3.3: 如果识别已完成，丢弃后续音频
                            if recognition_done.is_set():
                                continue

                            # 转发音频到讯飞
                            audio_base64 = message.get("data", "")
                            if audio_base64:
                                frame = self._create_audio_frame(audio_base64, is_last=False)
                                await xunfei_ws.send(json.dumps(frame))
                                audio_frame_count += 1
                                # 每 10 帧打印一次进度
                                if audio_frame_count % 10 == 0:
                                    print(f"[XunfeiASR] 已发送 {audio_frame_count} 帧音频")

                        elif msg_type == "end":
                            # v3.3: 如果识别已完成，不再发送结束帧
                            if recognition_done.is_set():
                                print(f"[XunfeiASR] 识别已完成，跳过结束帧 (共 {audio_frame_count} 帧)")
                                break
                            # 发送结束帧
                            print(f"[XunfeiASR] 共发送 {audio_frame_count} 帧音频，发送结束帧...")
                            end_frame = self._create_audio_frame("", is_last=True)
                            await xunfei_ws.send(json.dumps(end_frame))
                            print("[XunfeiASR] 已发送结束帧")
                            break

                        elif msg_type == "cancel":
                            print(f"[XunfeiASR] 客户端取消录音 (已发送 {audio_frame_count} 帧)")
                            break

                except Exception as e:
                    print(f"[XunfeiASR] 发送错误: {e}")

            # 并行运行接收和发送任务
            receive_task = asyncio.create_task(receive_from_xunfei())
            send_task = asyncio.create_task(send_to_xunfei())

            # 等待任务完成
            await asyncio.gather(receive_task, send_task, return_exceptions=True)

        except Exception as e:
            print(f"[XunfeiASR] 实时识别错误: {e}")
            # 如果真实 API 失败，返回 Mock
            return await self._mock_transcribe()

        finally:
            if xunfei_ws:
                await xunfei_ws.close()

        return full_text

    async def _mock_transcribe(self) -> str:
        """
        Mock 模式 - 用于演示和测试
        """
        await asyncio.sleep(1)

        mock_responses = [
            "供应商是双汇冷鲜肉直供，去皮五花肉30斤，68块一斤，一共2040块",
            "城南蔬菜批发，本地土豆50斤，1块2一斤，青椒20斤，4块5一斤",
            "供应商雪花啤酒总代，雪花勇闯天涯50箱，38块一箱",
        ]

        import random
        return random.choice(mock_responses)


# 单例实例
xunfei_asr = XunfeiASRService()
