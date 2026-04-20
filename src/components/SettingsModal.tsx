import { useEffect, useState } from 'react';
import { X, Check, AlertCircle, Loader2, Sparkles, Key, Clock, Keyboard } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../hooks/useSettings';
import { lumen } from '../lib/api';
import { cn } from '../lib/cn';

type Tab = 'ai' | 'schedule' | 'shortcuts' | 'about';

interface Props { onClose: () => void; initialTab?: Tab; }

export function SettingsModal({ onClose, initialTab = 'ai' }: Props) {
  const { settings, aiConfig, loading, set, saveAIConfig, testAI } = useSettings();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-h-[80vh] rounded-xl border border-stroke bg-bg-elev shadow-2xl overflow-hidden flex"
      >
        {/* 侧边 Tab */}
        <nav className="w-40 border-r border-stroke bg-bg-card/50 p-2 flex-shrink-0">
          <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            设置
          </div>
          <div className="mt-2 space-y-0.5">
            <TabButton active={tab === 'ai'} onClick={() => setTab('ai')} icon={<Key size={13} />}>AI 配置</TabButton>
            <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={<Clock size={13} />}>计划任务</TabButton>
            <TabButton active={tab === 'shortcuts'} onClick={() => setTab('shortcuts')} icon={<Keyboard size={13} />}>快捷键</TabButton>
            <TabButton active={tab === 'about'} onClick={() => setTab('about')} icon={<Sparkles size={13} />}>关于</TabButton>
          </div>
        </nav>

        {/* 内容区 */}
        <div className="flex-1 flex flex-col min-h-0">
          <header className="h-10 px-4 border-b border-stroke flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-fg-muted uppercase tracking-wider">
              {tab === 'ai' && 'AI 配置'}
              {tab === 'schedule' && '计划任务'}
              {tab === 'shortcuts' && '快捷键'}
              {tab === 'about' && '关于'}
            </span>
            <button onClick={onClose} className="p-1 hover:bg-bg-soft rounded"><X size={14} /></button>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center text-fg-muted py-12">加载中…</div>
            ) : (
              <>
                {tab === 'ai' && aiConfig && <AITab config={aiConfig} onSave={saveAIConfig} onTest={testAI} />}
                {tab === 'schedule' && <ScheduleTab settings={settings} onSet={set} />}
                {tab === 'shortcuts' && <ShortcutsTab settings={settings} onSet={set} />}
                {tab === 'about' && <AboutTab />}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition',
        active ? 'bg-bg-soft text-fg' : 'text-fg-muted hover:text-fg hover:bg-bg-card'
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

/* ---------- AI Tab ---------- */

const PRESETS = [
  {
    id: 'siliconflow',
    name: '硅基流动',
    desc: '国内推荐，价格低，支持对话+嵌入',
    baseUrl: 'https://api.siliconflow.cn/v1',
    chatModel: 'deepseek-ai/DeepSeek-V3',
    embedModel: 'BAAI/bge-m3',
    sttModel: 'FunAudioLLM/SenseVoiceSmall',
    keyHint: '前往 siliconflow.cn 获取 API Key',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: '国内高质量对话，暂无嵌入接口',
    baseUrl: 'https://api.deepseek.com',
    chatModel: 'deepseek-chat',
    embedModel: '',
    sttModel: '',
    keyHint: '前往 platform.deepseek.com 获取 API Key（嵌入/织网/语音暂不可用）',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT-4o-mini + Embedding，需海外网络',
    baseUrl: 'https://api.openai.com/v1',
    chatModel: 'gpt-4o-mini',
    embedModel: 'text-embedding-3-small',
    sttModel: 'whisper-1',
    keyHint: '前往 platform.openai.com 获取 API Key',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: '聚合多家模型，按量计费',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'deepseek/deepseek-chat',
    embedModel: '',
    sttModel: '',
    keyHint: '前往 openrouter.ai 获取 API Key（嵌入/织网/语音暂不可用）',
    keyPlaceholder: 'sk-or-...',
  },
] as const;

function AITab({ config, onSave, onTest }: {
  config: { baseUrl: string; chatModel: string; embedModel: string; sttModel?: string; hasApiKey: boolean };
  onSave: (p: any) => Promise<void>;
  onTest: () => Promise<{ ok: boolean; response?: string; error?: string }>;
}) {
  // 根据当前 baseUrl 推断当前预设
  const currentPresetId = PRESETS.find(p => config.baseUrl.includes(new URL(p.baseUrl).hostname))?.id || 'custom';

  const [selectedPreset, setSelectedPreset] = useState(currentPresetId);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [chatModel, setChatModel] = useState(config.chatModel);
  const [embedModel, setEmbedModel] = useState(config.embedModel);
  const [sttModel, setSttModel] = useState(config.sttModel || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  function selectPreset(id: string) {
    setSelectedPreset(id);
    setTestResult(null);
    if (id === 'custom') {
      setShowAdvanced(true);
      return;
    }
    const p = PRESETS.find(x => x.id === id);
    if (p) {
      setBaseUrl(p.baseUrl);
      setChatModel(p.chatModel);
      setEmbedModel(p.embedModel);
      setSttModel(p.sttModel);
    }
  }

  const activePreset = PRESETS.find(p => p.id === selectedPreset);

  async function save() {
    setSaving(true);
    const partial: any = { baseUrl, chatModel, embedModel, sttModel };
    if (apiKey.trim()) partial.apiKey = apiKey.trim();
    await onSave(partial);
    setSaving(false);
    setApiKey('');
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const r = await onTest();
    setTesting(false);
    setTestResult({
      ok: r.ok,
      message: r.ok ? `连接正常：${r.response}` : `失败：${r.error}`,
    });
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* 服务商选择 */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-fg-muted mb-2">选择 AI 服务商</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => selectPreset(p.id)}
              className={cn(
                'p-3 rounded-lg border text-left transition',
                selectedPreset === p.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-stroke hover:border-fg-muted bg-bg-card/50'
              )}
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-fg-muted mt-0.5 leading-snug">{p.desc}</div>
            </button>
          ))}
          <button
            onClick={() => selectPreset('custom')}
            className={cn(
              'p-3 rounded-lg border text-left transition col-span-2',
              selectedPreset === 'custom'
                ? 'border-accent bg-accent-soft'
                : 'border-stroke hover:border-fg-muted bg-bg-card/50'
            )}
          >
            <div className="text-sm font-medium">自定义</div>
            <div className="text-[11px] text-fg-muted mt-0.5">填写任意 OpenAI 兼容端点的 URL 和模型名</div>
          </button>
        </div>
      </div>

      {/* API Key — 主输入 */}
      <Field
        label="API Key"
        hint={config.hasApiKey
          ? '已配置（加密存储）。留空保留原值。'
          : (activePreset?.keyHint || '填写后点击保存。')
        }
      >
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input"
          placeholder={config.hasApiKey ? '••••••••••••••' : (activePreset?.keyPlaceholder || 'sk-...')}
          autoFocus
        />
      </Field>

      {/* 高级设置（默认折叠，自定义预设时展开） */}
      <div>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="text-xs text-fg-muted hover:text-fg transition flex items-center gap-1"
        >
          <span className={cn('inline-block transition-transform', showAdvanced && 'rotate-90')}>▶</span>
          高级设置
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-4 pl-3 border-l-2 border-stroke">
            <Field label="API Base URL" hint="OpenAI 兼容端点地址">
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="input" placeholder="https://api.openai.com/v1" />
            </Field>
            <Field label="对话模型" hint="用于 Ask Lumen 和 AI 织网">
              <input value={chatModel} onChange={(e) => setChatModel(e.target.value)} className="input" />
            </Field>
            <Field label="嵌入模型" hint="用于语义检索（留空则跳过嵌入）">
              <input value={embedModel} onChange={(e) => setEmbedModel(e.target.value)} className="input" placeholder="留空 = 不使用嵌入" />
            </Field>
            <Field label="语音模型" hint="用于捕捉窗口的语音输入（Whisper 兼容，留空则禁用）">
              <input value={sttModel} onChange={(e) => setSttModel(e.target.value)} className="input" placeholder="whisper-1 / FunAudioLLM/SenseVoiceSmall" />
            </Field>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          保存
        </button>
        <button onClick={test} disabled={testing || (!config.hasApiKey && !apiKey)} className="btn">
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          测试连接
        </button>
        {savedMsg && <span className="text-xs text-accent self-center">已保存 ✓</span>}
      </div>

      {testResult && (
        <div className={cn(
          'p-3 rounded-lg border flex items-start gap-2 text-sm',
          testResult.ok ? 'border-accent/30 bg-accent-soft text-accent' : 'border-red-500/30 bg-red-500/10 text-red-400'
        )}>
          {testResult.ok ? <Check size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
          <span className="break-all">{testResult.message}</span>
        </div>
      )}

      <Tip>
        所有 AI 调用都直接从你的电脑出发，Lumen 不经手你的数据。API Key 使用系统加密安全存储。
      </Tip>
    </div>
  );
}

/* ---------- Schedule Tab ---------- */

function ScheduleTab({ settings, onSet }: { settings: Record<string, any>; onSet: (k: string, v: any) => Promise<void> }) {
  const [digestTime, setDigestTime] = useState<string>(settings['schedule.digestTime'] || '23:30');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSet('schedule.digestTime', digestTime);
    setSaving(false);
  }

  async function generateNow() {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await lumen().digest.generate(today);
    alert('已生成今日复盘');
  }

  return (
    <div className="space-y-5 max-w-lg">
      <Field label="每日复盘时间" hint="每天到此时间，AI 会读取你当天的笔记生成一段复盘。">
        <input
          type="time"
          value={digestTime}
          onChange={(e) => setDigestTime(e.target.value)}
          className="input w-32"
        />
      </Field>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          保存
        </button>
        <button onClick={generateNow} className="btn">
          <Sparkles size={14} />
          立即生成今日复盘
        </button>
      </div>

      <Tip>提示：每小时还会自动回扫一次未织网的笔记（embedding / 标签 / 关联）。</Tip>
    </div>
  );
}

/* ---------- Shortcuts Tab ---------- */

function ShortcutsTab({ settings, onSet }: { settings: Record<string, any>; onSet: (k: string, v: any) => Promise<void> }) {
  const [captureKey, setCaptureKey] = useState<string>(settings['shortcut.capture'] || 'CommandOrControl+Alt+Space');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSet('shortcut.capture', captureKey);
    setSaving(false);
  }

  return (
    <div className="space-y-5 max-w-lg">
      <Field label="闪念捕捉（全局）" hint="Electron Accelerator 格式，例如 CommandOrControl+Alt+Space">
        <input value={captureKey} onChange={(e) => setCaptureKey(e.target.value)} className="input font-mono" />
      </Field>

      <div className="pt-2">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          保存
        </button>
      </div>

      <div className="pt-4 border-t border-stroke">
        <div className="text-xs uppercase tracking-wider text-fg-muted mb-2">应用内（不可改）</div>
        <ul className="space-y-1.5 text-sm">
          <ShortcutRow keys="Ctrl K" label="命令面板 / 搜索" />
          <ShortcutRow keys="Ctrl /" label="切换 Ask Lumen" />
          <ShortcutRow keys="Ctrl ," label="打开设置" />
          <ShortcutRow keys="Ctrl Enter" label="保存当前编辑" />
          <ShortcutRow keys="Esc" label="关闭弹窗 / 取消编辑" />
        </ul>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <li className="flex items-center justify-between py-1">
      <span className="text-fg-muted">{label}</span>
      <div className="flex gap-1">
        {keys.split(' ').map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}
      </div>
    </li>
  );
}

/* ---------- About Tab ---------- */

function AboutTab() {
  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <Sparkles size={32} className="text-accent" />
        <div>
          <div className="text-xl font-serif">Lumen · 灵犀</div>
          <div className="text-xs text-fg-muted">版本 0.1.0</div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">
        一款本地优先、AI 原生的桌面第二大脑。<br />
        想法一闪而过，Lumen 帮你记住。
      </p>
      <div className="text-xs text-fg-dim space-y-1">
        <div>数据存储：<code className="text-fg-muted">%APPDATA%/Lumen/lumen.db</code></div>
        <div>AI 引擎：OpenAI 兼容 API（本地调用）</div>
      </div>
    </div>
  );
}

/* ---------- shared primitives ---------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-fg-muted mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-xs text-fg-dim mt-1.5">{hint}</div>}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-bg-card border border-stroke text-xs text-fg-muted leading-relaxed">
      {children}
    </div>
  );
}
