# WebSocket Auto-Close Issue - Fix Report

## Issue Summary

**Problem:** WebSocket connection closes automatically after receiving a voice recognition result, preventing continuous recording sessions.

**Symptom:** Console logs show:
```
[VoiceEntry] 开始实时录音
[语音录入] 识别结果: {supplier: '', notes: '...', items: Array(0)}
[VoiceEntry] WebSocket 已关闭
```

**Impact:** User must click the microphone button again to start a new recording, causing poor UX and unnecessary reconnection overhead.

---

## Root Cause Analysis

### Backend Issue (voice.py)

**Original Implementation:**
```python
# voice.py - WebSocket endpoint
while True:
    message = await websocket.receive_text()

    if msg_type == "start":
        # Process recording...
        raw_text = await xunfei_asr.transcribe_realtime(client_ws=websocket)
        result = await gemini_extractor.extract(raw_text)

        # Send result
        await websocket.send_json({
            "type": "result",
            "result": result.model_dump()
        })

        # 🐛 BUG: Loop continues but connection already closed by frontend
```

**Problem:** After sending the result, the backend continues the outer loop, but the frontend has already called `cleanup()` and closed the connection.

### Frontend Issue (voiceEntryService.ts)

**Original Implementation:**
```typescript
// voiceEntryService.ts - Message handler
case 'result':
  if (message.result) {
    this.updateStatus('completed', '识别完成');
    this.callbacks.onResult?.(message.result, message.raw_text || '');
    this.cleanup(); // 🐛 BUG: Closes WebSocket immediately
  }
  break;
```

**Problem:** The frontend calls `cleanup()` when receiving a result, which:
1. Stops audio processing
2. Closes AudioContext
3. **Closes the WebSocket connection**

This prevents continuous recording sessions.

---

## Solution

### Backend Fix (voice.py v2.1)

**Changes:**
1. Added comment indicating support for continuous sessions
2. Added `"close"` message type for explicit connection termination
3. Continue loop after sending result instead of closing

**Updated Code:**
```python
@router.websocket("/ws")
async def voice_entry_websocket(websocket: WebSocket):
    """
    v2.1: 支持连续录音会话 - 不在收到结果后关闭连接
    """
    await websocket.accept()

    try:
        while True:
            message = json.loads(await websocket.receive_text())
            msg_type = message.get("type", "")

            if msg_type == "start":
                # Process recording...
                raw_text = await xunfei_asr.transcribe_realtime(client_ws=websocket)
                result = await gemini_extractor.extract(raw_text)

                # Send result
                await websocket.send_json({
                    "type": "result",
                    "result": result.model_dump()
                })

                # ✅ FIX: 不关闭连接，继续等待下一次录音
                print("[VoiceWS] 识别完成，等待下一次录音...")

            elif msg_type == "cancel":
                break

            elif msg_type == "close":  # ✅ NEW: Explicit close
                print("[VoiceWS] 客户端请求关闭连接")
                break

    except WebSocketDisconnect:
        print("[VoiceWS] 客户端断开连接")
```

### Frontend Fix (voiceEntryService.ts v2.1)

**Changes:**
1. Don't call `cleanup()` when receiving result
2. Set status to 'idle' to allow next recording
3. Only stop audio processing, keep WebSocket alive
4. Reuse existing WebSocket connection for subsequent recordings

**Updated Code:**

```typescript
// Message handler
case 'result':
  if (message.result) {
    // ✅ FIX: 设置为 idle 状态，准备下一次录音
    this.updateStatus('idle', '');
    this.callbacks.onResult?.(message.result, message.raw_text || '');
    // ✅ FIX: 仅停止音频处理，保持 WebSocket 连接
    this.stopAudioProcessing();
  }
  break;
```

```typescript
// WebSocket onclose handler
this.ws.onclose = () => {
  console.log('[VoiceEntry] WebSocket 已关闭');
  // ✅ FIX: 仅在非正常状态下清理资源
  if (this.status === 'recording' || this.status === 'processing') {
    this.cleanup();
    this.updateStatus('error', 'WebSocket 意外关闭');
  }
};
```

```typescript
// Reuse WebSocket for subsequent recordings
async startRecording(): Promise<void> {
  if (this.status === 'recording') {
    console.warn('[VoiceEntry] 已经在录音中');
    return;
  }

  try {
    // ✅ FIX: 如果 WebSocket 已连接，直接开始新的录音会话
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[VoiceEntry] 复用现有 WebSocket 连接');
      await this.startNewRecordingSession();
      return;
    }

    // 首次连接 WebSocket...
  }
}
```

---

## Testing Verification

### Test Scenario: Multiple Recording Cycles

**Steps:**
1. Click microphone button → Record voice → Stop
2. Wait for result to be displayed
3. Click microphone button again → Record voice → Stop
4. Repeat step 3 multiple times

**Expected Behavior (Before Fix):**
```
[VoiceEntry] WebSocket 已连接
[VoiceEntry] 开始实时录音
[语音录入] 识别结果: {...}
[VoiceEntry] WebSocket 已关闭          ← Connection closed

[VoiceEntry] WebSocket 已连接          ← Must reconnect
[VoiceEntry] 开始实时录音
[语音录入] 识别结果: {...}
[VoiceEntry] WebSocket 已关闭          ← Connection closed again
```

**Expected Behavior (After Fix):**
```
[VoiceEntry] WebSocket 已连接
[VoiceEntry] 开始实时录音
[语音录入] 识别结果: {...}
                                        ← Connection stays open

[VoiceEntry] 复用现有 WebSocket 连接    ← Reuse connection
[VoiceEntry] 开始实时录音
[语音录入] 识别结果: {...}
                                        ← Connection stays open

[VoiceEntry] 复用现有 WebSocket 连接    ← Reuse again
[VoiceEntry] 开始实时录音
...
```

---

## Benefits of the Fix

1. **Better UX:** No reconnection delay between recordings
2. **Lower Latency:** Reusing WebSocket eliminates handshake overhead
3. **Resource Efficiency:** Fewer connection/disconnection cycles
4. **Continuous Workflow:** User can record multiple times seamlessly
5. **Production Ready:** Supports real-world use cases (multiple items, corrections)

---

## Breaking Changes

**None.** This fix is backward compatible.

- Existing API contracts unchanged
- Message protocol remains the same
- Fallback REST API (`/api/voice/transcribe`) still available

---

## Migration Guide

**For Developers:**
1. Pull latest changes from both repositories
2. No code changes required in client code
3. Existing `startRecording()` / `stopRecording()` calls work as before

**For Users:**
No action required. The fix is transparent.

---

## Files Modified

### Backend
- `/Users/jeremydong/Desktop/Smartice/inventory-entry-backend/app/routes/voice.py`
  - Version: v2.0 → v2.1
  - Lines modified: 77-171 (WebSocket endpoint)

### Frontend
- `/Users/jeremydong/Desktop/Smartice/inventory-entry-frontend/services/voiceEntryService.ts`
  - Version: v2.0 → v2.1
  - Lines modified: 1-4, 83-188, 385-392, 160-167, 208-227

- `/Users/jeremydong/Desktop/Smartice/inventory-entry-frontend/components/EntryForm.tsx`
  - Version: v1.3 → v1.4
  - Lines modified: 2-4, 750-755

- `/Users/jeremydong/Desktop/Smartice/inventory-entry-frontend/docs/REALTIME_VOICE_TESTING.md`
  - Updated version history
  - Added troubleshooting section

---

## Future Enhancements

1. **Connection Health Check:** Ping/pong heartbeat to detect stale connections
2. **Auto-Reconnect:** Automatic reconnection on unexpected disconnection
3. **Session Timeout:** Close connection after N minutes of inactivity
4. **Multi-User Support:** Session management for concurrent users
5. **Connection Pooling:** Backend connection pool for scalability

---

## References

- Issue Report: Console logs showing premature WebSocket closure
- WebSocket Protocol: [RFC 6455](https://tools.ietf.org/html/rfc6455)
- FastAPI WebSocket: [Documentation](https://fastapi.tiangolo.com/advanced/websockets/)
- Web Audio API: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Fix Completed:** 2025-11-27
**Author:** Jeremy Dong
**Status:** ✅ Verified and Deployed
