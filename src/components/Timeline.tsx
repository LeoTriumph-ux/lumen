import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { groupNotes, formatTime } from '../lib/time';
import { extractTitle } from '../lib/markdown';
import { cn } from '../lib/cn';
import type { Note, Stats } from '../types';

interface Props {
  notes: Note[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewCapture: () => void;
  stats: Stats;
  loading: boolean;
}

export function Timeline({ notes, selectedId, onSelect, onNewCapture, stats, loading }: Props) {
  const groups = useMemo(() => groupNotes(notes), [notes]);

  return (
    <aside className="w-[280px] border-r border-stroke bg-bg-elev flex flex-col flex-shrink-0">
      {/* 新捕捉按钮 */}
      <div className="p-3 border-b border-stroke">
        <button
          onClick={onNewCapture}
          className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-strong transition flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          <span>新捕捉</span>
          <kbd className="ml-2 px-1.5 py-0.5 bg-black/20 rounded text-[10px]">⌃⌥Space</kbd>
        </button>
      </div>

      {/* 时间线 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {loading && groups.length === 0 ? (
          <div className="p-4 text-xs text-fg-dim text-center">加载中…</div>
        ) : groups.length === 0 ? (
          <div className="p-4 text-xs text-fg-dim text-center">还没有笔记</div>
        ) : (
          groups.map(group => (
            <div key={group.key}>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-fg-muted">{group.label}</span>
                <span className="text-[10px] text-fg-dim">{group.notes.length}</span>
              </div>
              <div className="space-y-0.5">
                {group.notes.map(note => (
                  <NoteTimelineItem
                    key={note.id}
                    note={note}
                    selected={note.id === selectedId}
                    onSelect={() => onSelect(note.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-stroke px-4 py-2.5 text-[11px] text-fg-muted flex justify-between flex-shrink-0">
        <span>共 {stats.total} 条</span>
        <span>
          已织网 {stats.woven}
          {stats.total > stats.woven && (
            <span className="text-accent ml-1 animate-shimmer">· 织网中</span>
          )}
        </span>
      </div>
    </aside>
  );
}

interface ItemProps {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}

function NoteTimelineItem({ note, selected, onSelect }: ItemProps) {
  const title = extractTitle(note.content, 36) || '（空）';
  const primaryTag = note.tags.find(t => t.ai_generated) || note.tags[0];

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-2.5 py-2 rounded-md transition border',
        selected
          ? 'bg-bg-soft border-accent/30'
          : 'border-transparent hover:bg-bg-card hover:border-stroke'
      )}
    >
      <div className="flex items-center gap-2 text-[10px] text-fg-muted mb-1">
        <span>{formatTime(note.createdAt)}</span>
        {primaryTag && (
          <span className="chip chip-accent !text-[9px] !py-0">
            {primaryTag.name}
          </span>
        )}
        {!note.woven && <span className="text-fg-dim">·</span>}
        {!note.woven && <span className="text-fg-dim animate-shimmer">织网中</span>}
      </div>
      <div className="text-[13px] truncate">{title}</div>
    </button>
  );
}
