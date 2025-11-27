# 语音录入 API 路由
# v2.2 - 实时流式语音识别 WebSocket + REST 备用接口
# v2.1: 支持连续录音会话，收到识别结果后不关闭 WebSocket
# v2.2: 添加 stop_recording 信号，通知前端停止发送音频（配合后端 v3.3）
# 支持 WebM -> PCM 音频格式转换，实时返回部分识别结果

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import base64
import json
import asyncio
import subprocess
import tempfile
import os
from typing import Optional

from app.models.voice_entry import VoiceEntryResult, VoiceMessage, ASRStatus
from app.services.xunfei_asr import xunfei_asr
from app.services.gemini_extractor import gemini_extractor


async def convert_audio_to_pcm(audio_data: bytes, input_format: str = "webm") -> bytes:
    """
    使用 ffmpeg 将音频转换为 PCM 格式 (16kHz, 16bit, mono)

    Args:
        audio_data: 原始音频数据
        input_format: 输入格式 (webm, mp3, wav 等)

    Returns:
        PCM 音频数据
    """
    with tempfile.NamedTemporaryFile(suffix=f".{input_format}", delete=False) as input_file:
        input_file.write(audio_data)
        input_path = input_file.name

    output_path = input_path + ".pcm"

    try:
        # 使用 ffmpeg 转换
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ar", "16000",      # 采样率 16kHz
            "-ac", "1",          # 单声道
            "-f", "s16le",       # 16-bit signed little-endian PCM
            output_path
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=30
        )

        if result.returncode != 0:
            print(f"[AudioConvert] ffmpeg 错误: {result.stderr.decode()}")
            raise Exception(f"音频转换失败: {result.stderr.decode()}")

        # 读取转换后的 PCM 数据
        with open(output_path, "rb") as f:
            pcm_data = f.read()

        print(f"[AudioConvert] 转换成功: {len(audio_data)} -> {len(pcm_data)} bytes")
        return pcm_data

    finally:
        # 清理临时文件
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)


router = APIRouter(prefix="/api/voice", tags=["语音录入"])


@router.websocket("/ws")
async def voice_entry_websocket(websocket: WebSocket):
    """
    WebSocket 实时流式语音录入接口

    协议说明 (实时模式):
    - 客户端发送: { "type": "start" } 开始录音
    - 客户端发送: { "type": "audio", "data": "<base64 encoded PCM>" } 音频块
    - 客户端发送: { "type": "end" } 结束录音
    - 服务端返回: { "type": "status", "status": "listening", "message": "..." }
    - 服务端返回: { "type": "partial", "text": "实时识别文本..." }
    - 服务端返回: { "type": "result", "raw_text": "完整文本", "result": {...} }

    音频格式要求:
    - PCM: 16kHz, 16bit, 单声道
    - 建议每 40ms 发送一次音频块 (1280 bytes)

    v2.1: 支持连续录音会话 - 不在收到结果后关闭连接
    """
    await websocket.accept()
    print("[VoiceWS] 客户端已连接")

    try:
        while True:
            # 接收开始信号
            raw_message = await websocket.receive_text()
            message = json.loads(raw_message)
            msg_type = message.get("type", "")

            if msg_type == "start":
                # 发送状态确认
                await websocket.send_json({
                    "type": "status",
                    "status": ASRStatus.LISTENING.value,
                    "message": "开始录音..."
                })
                print("[VoiceWS] 开始实时识别")

                try:
                    # 使用实时流式识别
                    raw_text = await xunfei_asr.transcribe_realtime(
                        client_ws=websocket
                    )
                    print(f"[VoiceWS] 最终识别文本: {raw_text}")

                    # v2.2: 通知前端停止录音（讯飞已完成识别，VAD检测到静音）
                    await websocket.send_json({
                        "type": "stop_recording",
                        "message": "识别完成，停止录音"
                    })

                    # 更新状态
                    await websocket.send_json({
                        "type": "status",
                        "status": ASRStatus.PROCESSING.value,
                        "message": "正在解析..."
                    })

                    # Step 2: 结构化提取
                    result = await gemini_extractor.extract(raw_text)
                    print(f"[VoiceWS] 提取结果: {result.model_dump()}")

                    # 发送最终结果
                    await websocket.send_json({
                        "type": "result",
                        "status": ASRStatus.COMPLETED.value,
                        "raw_text": raw_text,
                        "result": result.model_dump()
                    })

                    # v2.1: 不关闭连接，继续等待下一次录音
                    print("[VoiceWS] 识别完成，等待下一次录音...")

                except Exception as e:
                    print(f"[VoiceWS] 处理错误: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "status": ASRStatus.ERROR.value,
                        "error": str(e)
                    })
                    # 出错后继续保持连接

            elif msg_type == "cancel":
                print("[VoiceWS] 客户端取消录音")
                break

            elif msg_type == "close":
                print("[VoiceWS] 客户端请求关闭连接")
                break

    except WebSocketDisconnect:
        print("[VoiceWS] 客户端断开连接")
    except Exception as e:
        print(f"[VoiceWS] 连接错误: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "error": str(e)
            })
        except:
            pass


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(..., description="音频文件 (WebM/WAV/PCM, 自动转换)")
):
    """
    REST API: 上传音频文件进行识别

    支持格式:
    - WebM (推荐，浏览器默认格式，自动转换为 PCM)
    - WAV: 16kHz (自动跳过 WAV 头)
    - PCM: 16kHz, 16bit, 单声道

    Returns:
        VoiceEntryResult: 结构化的采购清单
    """
    try:
        # 读取音频数据
        audio_data = await audio.read()
        filename = audio.filename or "recording.webm"

        print(f"[VoiceAPI] 收到音频文件: {filename}, 大小: {len(audio_data)} bytes")

        # 根据文件格式处理
        if filename.endswith(".webm") or audio.content_type == "audio/webm":
            # WebM -> PCM 转换
            print("[VoiceAPI] 检测到 WebM 格式，开始转换...")
            audio_data = await convert_audio_to_pcm(audio_data, "webm")
        elif filename.endswith(".wav"):
            # WAV 格式，跳过 44 字节的头
            audio_data = audio_data[44:]
        # 其他格式假设为 PCM

        # Step 1: 语音识别
        raw_text = await xunfei_asr.transcribe_audio_bytes(audio_data)
        print(f"[VoiceAPI] ASR 结果: {raw_text}")

        # Step 2: 结构化提取
        result = await gemini_extractor.extract(raw_text)

        return JSONResponse(content={
            "success": True,
            "raw_text": raw_text,
            "result": result.model_dump()
        })

    except Exception as e:
        print(f"[VoiceAPI] 处理错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class TextInput(BaseModel):
    """文本输入模型"""
    text: str


@router.post("/extract")
async def extract_from_text(input_data: TextInput):
    """
    REST API: 直接从文本提取结构化数据 (跳过 ASR)

    用于测试 Gemini 提取功能

    Args:
        input_data: 包含 text 字段的 JSON 请求体

    Returns:
        VoiceEntryResult: 结构化的采购清单
    """
    try:
        result = await gemini_extractor.extract(input_data.text)
        return JSONResponse(content={
            "success": True,
            "result": result.model_dump()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """
    健康检查接口
    """
    return {
        "status": "ok",
        "services": {
            "xunfei_asr": "configured" if xunfei_asr.app_id else "mock_mode",
            "gemini_extractor": "configured" if gemini_extractor.available else "mock_mode"
        }
    }
