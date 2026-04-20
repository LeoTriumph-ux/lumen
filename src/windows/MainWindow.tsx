import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Search, Settings as SettingsIcon, X, PanelRightClose, PanelRightOpen, Key, AlertCircle } from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import { useSettings } from '../hooks/useSettings';
import { useShortcut } from '../hooks/useShortcuts';
import { lumen } from '../lib/api';
import { Timeline } from '../components/Timeline';
import { NoteView } from '../components/NoteView';
import { DailyDigest } from '../components/DailyDigest';
import { AskLumen } from '../components/AskLumen';
import { CommandBar } from '../components/CommandBar';
import { SettingsModal } from '../components/SettingsModal';
import { EmptyState } from '../components/EmptyState';
import type { DailySummary } from '../types';

/**
 * 主窗口：三栏布局（时间线 · 笔记 · Ask Lumen）
 */
export function MainWindow() {
  const { notes, stats, loading, update, remove, archive, reload } = useNotes();
  const { aiConfig, reload: reloadSettings } = useSettings();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAsk, setShowAsk] = useState(true);
  const [showCmd, setShowCmd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [digest, setDigest] = useState<DailySummary | null>(null);
  const pendingNoteRef = useRef<number | null>(null);

  const aiConfigured = !!aiConfig?.hasApiKey;
  const showAIBanner = !loading && !aiConfigured && !bannerDismissed;

  function openAISettings() {
    setShowSettings(true);
  }

  // 初始加载今日复盘
  useEffect(() => {
    lumen().digest.today().then(setDigest);
    const off = lumen().on('digest:ready', (p: any) => setDigest(p.summary));
    return () => off();
  }, []);

  // 监听引用跳转事件（由 AskLumen 通过 CustomEvent 派发）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: number }>).detail;
      if (detail?.id) setSelectedId(detail.id);
    };
    window.addEventListener('lumen:jumpToNote', handler);
    return () => window.removeEventListener('lumen:jumpToNote', handler);
  }, []);

  // 捕捉窗口保存后自动跳转到新笔记
  useEffect(() => {
    const off = lumen().on('capture:saved', (noteId: any) => {
      if (typeof noteId === 'number') {
        pendingNoteRef.current = noteId;
        reload();
      }
    });
    return () => off();
  }, [reload]);

  // notes 刷新后：应用 pending 或默认选中第一条
  useEffect(() => {
    if (pendingNoteRef.current != null) {
      const pid = pendingNoteRef.current;
      if (notes.find(n => n.id === pid)) {
        setSelectedId(pid);
        pendingNoteRef.current = null;
        return;
      }
    }
    if (selectedId == null && notes.length > 0) {
      setSelectedId(notes[0].id);
    } else if (selectedId != null && !notes.find(n => n.id === selectedId)) {
      setSelectedId(notes[0]?.id ?? null);
    }
  }, [notes, selectedId]);

  useShortcut('mod+k', (e) => { e.preventDefault(); setShowCmd(true); }, []);
  useShortcut('mod+/', (e) => { e.preventDefault(); setShowAsk(v => !v); }, []);
  useShortcut(',', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setShowSettings(true);
  }, []);
  useShortcut('esc', () => { setShowCmd(false); setShowSettings(false); }, []);

  const hasNotes = notes.length > 0;
  const selected = useMemo(() => notes.find(n => n.id === selectedId) ?? null, [notes, selectedId]);

  return (
    <div className="app-root h-full w-full flex flex-col bg-bg text-fg overflow-hidden">
      {/* Top bar */}
      <header className="drag-region h-10 bg-bg-elev border-b border-stroke flex items-center px-4 gap-3 text-sm flex-shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Sparkles size={14} className="text-accent" />
          <span className="font-semibold">Lumen</span>
        </div>
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => setShowCmd(true)}
            className="no-drag px-3 py-1 rounded bg-bg-soft border border-stroke text-xs text-fg-muted flex items-center gap-2 hover:border-fg-muted w-72 transition"
          >
            <Search size={12} />
            <span>搜索笔记或执行命令</span>
            <kbd className="kbd ml-auto">⌃K</kbd>
          </button>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 no-drag">
          <button
            onClick={() => setShowAsk(v => !v)}
            className="p-1.5 hover:bg-bg-soft rounded text-fg-muted hover:text-fg"
            title="切换 Ask Lumen (Ctrl+/)"
          >
            {showAsk ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-2.5 py-1 hover:bg-bg-soft rounded text-fg-muted hover:text-fg flex items-center gap-1.5 text-xs mr-32"
            title="设置 (Ctrl+,)"
          >
            <SettingsIcon size={14} />
            <span>设置</span>
          </button>
        </div>
      </header>

      {/* AI 未配置横幅 */}
      {showAIBanner && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent-soft border-b border-accent/30 text-sm flex-shrink-0">
          <AlertCircle size={15} className="text-accent flex-shrink-0" />
          <div className="flex-1 text-fg">
            <span className="font-medium">AI 尚未配置。</span>
            <span className="text-fg-muted ml-1">配置 API Key 即可解锁 <b className="text-fg">自动织网</b>、<b className="text-fg">Ask Lumen</b>、<b className="text-fg">每日复盘</b>。笔记仍可正常保存与查看。</span>
          </div>
          <button
            onClick={openAISettings}
            className="px-3 py-1 bg-accent text-black text-xs font-semibold rounded hover:bg-accent-strong transition flex items-center gap-1.5 flex-shrink-0"
          >
            <Key size={12} />
            立即配置
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="p-1 hover:bg-bg-soft rounded text-fg-muted hover:text-fg flex-shrink-0"
            title="暂时关闭"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Three panels */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Timeline
          notes={notes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewCapture={() => lumen().capture.show()}
          stats={stats}
          loading={loading}
        />

        <main className="flex-1 overflow-y-auto bg-bg dot-pattern bg-gradient-radial">
          <div className="max-w-2xl mx-auto px-8 py-6 space-y-6">
            {digest && <DailyDigest summary={digest} onJumpTo={setSelectedId} onRefresh={setDigest} />}

            {!hasNotes && !loading ? (
              <EmptyState
                onNewCapture={() => lumen().capture.show()}
                onConfigureAI={openAISettings}
                aiConfigured={aiConfigured}
              />
            ) : selected ? (
              <NoteView
                note={selected}
                onUpdate={async (content) => { await update(selected.id, content); }}
                onDelete={() => remove(selected.id)}
                onArchive={() => archive(selected.id, !selected.archived)}
                onSelectNote={setSelectedId}
              />
            ) : (
              <div className="text-center text-fg-muted py-20 text-sm">加载中…</div>
            )}
          </div>
        </main>

        {showAsk && (
          <AskLumen
            onJumpToNote={(id) => setSelectedId(id)}
          />
        )}
      </div>

      {/* Modals */}
      {showCmd && (
        <CommandBar
          onClose={() => setShowCmd(false)}
          onSelectNote={(id) => { setSelectedId(id); setShowCmd(false); }}
          onAction={(action) => {
            setShowCmd(false);
            if (action === 'capture') lumen().capture.show();
            if (action === 'settings') setShowSettings(true);
            if (action === 'reload') reload();
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          initialTab="ai"
          onClose={() => { setShowSettings(false); reloadSettings(); }}
        />
      )}
    </div>
  );
}
