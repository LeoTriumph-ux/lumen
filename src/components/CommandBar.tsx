import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Settings as SettingsIcon, RefreshCw, FileText, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { lumen } from '../lib/api';
import { relativeTime } from '../lib/time';
import { extractTitle } from '../lib/markdown';
import type { Note } from '../types';
import { cn } from '../lib/cn';

type Action = 'capture' | 'settings' | 'reload';

interface CommandAction {
  kind: 'action';
  action: Action;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

interface NoteHit {
  kind: 'note';
  note: Note;
}

type Item = CommandAction | NoteHit;

interface Props {
  onClose: () => void;
  onSelectNote: (id: number) => void;
  onAction: (action: Action) => void;
}

export function CommandBar({ onClose, onSelectNote, onAction }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Note[]>([]);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions: CommandAction[] = [
    { kind: 'action', action: 'capture', label: '新建闪念', icon: <Plus size={14} />, shortcut: '⌃⌥Space' },
    { kind: 'action', action: 'settings', label: '打开设置', icon: <SettingsIcon size={14} />, shortcut: '⌃,' },
    { kind: 'action', action: 'reload', label: '刷新笔记列表', icon: <RefreshCw size={14} /> },
  ];

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setHits([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      lumen().notes.search(query, 20).then((r) => { if (!cancelled) setHits(r); });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const filteredActions = useMemo(
    () => actions.filter(a => !query.trim() || a.label.includes(query)),
    [query],
  );

  const items = useMemo<Item[]>(
    () => [
      ...filteredActions,
      ...hits.map(n => ({ kind: 'note' as const, note: n })),
    ],
    [filteredActions, hits],
  );

  useEffect(() => { setIndex(0); }, [query]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  function choose(i: number) {
    const item = items[i];
    if (!item) return;
    if (item.kind === 'action') onAction(item.action);
    else onSelectNote(item.note.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(index); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] rounded-xl border border-stroke bg-bg-elev shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stroke">
          <Search size={14} className="text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索笔记或执行命令..."
            className="flex-1 bg-transparent focus:outline-none text-sm selectable"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div ref={listRef} className="py-2 max-h-[400px] overflow-y-auto">
          {filteredActions.length > 0 && (
            <>
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-fg-dim">命令</div>
              {filteredActions.map((a, i) => {
                const globalIdx = i;
                return (
                  <CmdRow
                    key={a.action}
                    active={index === globalIdx}
                    onSelect={() => choose(globalIdx)}
                    onHover={() => setIndex(globalIdx)}
                  >
                    <span className="text-fg-muted">{a.icon}</span>
                    <span className="flex-1">{a.label}</span>
                    {a.shortcut && <kbd className="kbd">{a.shortcut}</kbd>}
                  </CmdRow>
                );
              })}
            </>
          )}

          {hits.length > 0 && (
            <>
              <div className="px-4 py-1 mt-2 text-[10px] uppercase tracking-wider text-fg-dim">
                笔记 · {hits.length} 条匹配
              </div>
              {hits.map((n, i) => {
                const globalIdx = filteredActions.length + i;
                return (
                  <CmdRow
                    key={n.id}
                    active={index === globalIdx}
                    onSelect={() => choose(globalIdx)}
                    onHover={() => setIndex(globalIdx)}
                  >
                    <FileText size={13} className="text-fg-muted" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{extractTitle(n.content, 60) || n.content.slice(0, 60)}</div>
                      <div className="text-xs text-fg-muted mt-0.5">
                        {relativeTime(n.createdAt)}
                        {n.tags[0] && ` · ${n.tags[0].name}`}
                      </div>
                    </div>
                    <ArrowRight size={12} className="text-fg-dim" />
                  </CmdRow>
                );
              })}
            </>
          )}

          {query && filteredActions.length === 0 && hits.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-fg-muted">
              没有匹配项
            </div>
          )}
        </div>

        <div className="border-t border-stroke px-4 py-2 text-[11px] text-fg-muted flex items-center justify-between">
          <span>↑↓ 选择 · ↵ 打开 · Esc 关闭</span>
          <span className="flex items-center gap-1">
            <span className="text-accent">✦</span>
            Lumen
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CmdRow({
  active, onSelect, onHover, children,
}: { active: boolean; onSelect: () => void; onHover: () => void; children: React.ReactNode }) {
  return (
    <button
      data-active={active}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition',
        active ? 'bg-bg-soft' : 'hover:bg-bg-card/50',
      )}
    >
      {children}
    </button>
  );
}
