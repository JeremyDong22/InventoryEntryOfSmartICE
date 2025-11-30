# 服务层
# v1.1 - 讯飞ASR + Qwen结构化提取
# v1.1: 移除 Gemini，切换到 Qwen

from .xunfei_asr import xunfei_asr
from .qwen_extractor import qwen_extractor

__all__ = ["xunfei_asr", "qwen_extractor"]
