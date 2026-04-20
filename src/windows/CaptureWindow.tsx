import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mic, Square, Loader2, X } from 'lucide-react';
import { lumen } from '../lib/api';

/**
 * 闪念捕捉窗口：极简输入框 + 快捷键
 * Ctrl+Enter 保存 / Esc 关闭 / 失焦由主进程处理（close）
 */
const BAR_COUNT = 32;

export function CaptureWindow() {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const [sttModelName, setSttModelName] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    textareaRef.current?.focus();
    lumen().settings.all().then((s) => {
      const cfg = s['ai.config'] || {};
      setAiReady(!!cfg.hasApiKey);
      setSttModelName(cfg.sttModel || '');
    });
  }, []);

  function cleanupAudio() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }

  function startVisualization(stream: MediaStream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    const step = Math.floor(bufLen / BAR_COUNT);

    // EMA 平滑历史值，避免每帧突变
    const smooth = new Array<number>(BAR_COUNT).fill(0);
    const alpha = 0.35; // 平滑系数，越小越平滑

    const tick = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        const raw = Math.min(1, (sum / step / 255) * 1.4);
        smooth[i] = smooth[i] + (raw - smooth[i]) * alpha;
      }
      setLevels([...smooth]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function startRecording() {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        cleanupAudio();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        setLevels(Array(BAR_COUNT).fill(0));
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const buffer = await blob.arrayBuffer();
          const result = await lumen().ai.transcribe(buffer, blob.type);
          if (result.ok && result.text) {
            setValue((prev) => (prev ? prev + (prev.endsWith('\n') ? '' : ' ') : '') + result.text);
            textareaRef.current?.focus();
          } else {
            setRecError(result.error || '转写失败');
          }
        } catch (e: any) {
          setRecError(e?.message || '转写异常');
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      startVisualization(stream);
      startTimeRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch (e: any) {
      setRecError(e?.message || '无法访问麦克风');
      setRecording(false);
      cleanupAudio();
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  function cancelRecording() {
    chunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        cleanupAudio();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setLevels(Array(BAR_COUNT).fill(0));
      };
      mediaRecorderRef.current.stop();
    } else {
      cleanupAudio();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setLevels(Array(BAR_COUNT).fill(0));
    }
    setRecording(false);
  }

  // 组件卸载时清理
  useEffect(() => () => cleanupAudio(), []);

  async function save() {
    const content = value.trim();
    if (!content || saving) { await lumen().capture.close(); return; }
    setSaving(true);
    try {
      const note = await lumen().notes.create({ content });
      await lumen().capture.close(note?.id);
    } catch (e) {
      console.error(e);
      await lumen().capture.close();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      lumen().capture.close();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      className="h-full w-full flex flex-col"
    >
      <div className="relative w-full h-full bg-bg-elev border border-stroke overflow-hidden flex flex-col">
        {/* 顶部提示条（可拖拽） */}
        <div className="drag-region h-8 px-4 flex items-center justify-between border-b border-stroke bg-bg-card/50 text-[11px]">
          <div className="flex items-center gap-1.5 text-fg-muted">
            <Sparkles size={12} className="text-accent" />
            <span>闪念</span>
          </div>
          <div className="flex items-center gap-3 text-fg-dim no-drag">
            <span>{value.length} 字</span>
            <kbd className="kbd">Esc</kbd>
          </div>
        </div>

        {/* 输入区 */}
        <div className="flex-1 p-4 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="此刻，什么在你脑海？"
            className="w-full h-full resize-none bg-transparent font-serif text-base leading-7 focus:outline-none placeholder:text-fg-dim"
          />
        </div>

        {/* 底部栏 */}
        <div className="h-9 px-4 flex items-center justify-between border-t border-stroke bg-bg-card/30 text-[11px] text-fg-muted">
          <div className="flex items-center gap-3">
            <kbd className="kbd">⌃↵</kbd>
            <span>保存</span>
            {recError && (
              <span className="text-red-400 truncate max-w-[260px]" title={recError}>⚠ {recError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {aiReady && (
              <button
                onClick={() => {
                  if (!sttModelName) {
                    setRecError('未配置语音模型：请到设置 → AI 配置 → 高级设置 填写 sttModel');
                    return;
                  }
                  recording ? stopRecording() : startRecording();
                }}
                disabled={transcribing || saving}
                className={
                  recording
                    ? 'px-2.5 py-[3px] rounded bg-red-500/90 text-white text-xs font-medium flex items-center gap-1 hover:bg-red-500'
                    : 'px-2.5 py-[3px] rounded border border-stroke hover:border-accent text-fg-muted hover:text-accent text-xs flex items-center gap-1 disabled:opacity-40'
                }
                title={sttModelName ? (recording ? '点击停止并转写' : `语音输入 (${sttModelName})`) : '未配置语音模型'}
              >
                {transcribing ? (
                  <><Loader2 size={11} className="animate-spin" /> 转写中…</>
                ) : recording ? (
                  <><Square size={10} fill="currentColor" /> 停止</>
                ) : (
                  <><Mic size={11} /> 语音</>
                )}
              </button>
            )}
            <button
              onClick={save}
              disabled={!value.trim() || saving}
              className="px-3 py-[3px] rounded bg-accent text-black text-xs font-medium hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>

        {/* 录音浮层（GPT 风格沉浸式 UI） */}
        <AnimatePresence>
          {recording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-10 bg-bg-elev/95 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-4"
            >
              {/* 波形：用 transform scaleY 代替 height，GPU 合成不触发布局 */}
              <div className="flex items-center justify-center gap-[3px] h-16">
                {levels.map((v, i) => (
                  <div
                    key={i}
                    className="w-[5px] h-12 rounded-full bg-accent"
                    style={{
                      transform: `scaleY(${Math.max(0.08, v)})`,
                      transformOrigin: 'center',
                      opacity: 0.55 + v * 0.45,
                      willChange: 'transform',
                    }}
                  />
                ))}
              </div>
              {/* 计时器：固定宽度 */}
              <div className="font-mono text-xs text-fg-muted tabular-nums w-16 text-center">
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </div>
              {/* 按钮组 */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={cancelRecording}
                  className="w-9 h-9 rounded-full border border-stroke hover:border-fg-muted text-fg-muted hover:text-fg flex items-center justify-center transition flex-shrink-0"
                  title="取消"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={stopRecording}
                  className="w-12 h-12 rounded-full bg-accent hover:bg-accent-strong text-black flex items-center justify-center transition shadow-lg flex-shrink-0"
                  title="完成 · 开始转写"
                >
                  <Square size={16} fill="currentColor" />
                </button>
                <div className="w-9 h-9 flex-shrink-0" aria-hidden="true" />
              </div>
            </motion.div>
          )}
          {transcribing && !recording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-bg-elev/95 backdrop-blur-md flex flex-col items-center justify-center gap-3"
            >
              <Loader2 size={28} className="animate-spin text-accent" />
              <div className="text-sm text-fg-muted">正在转写…</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
