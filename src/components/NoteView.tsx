import { useEffect, useRef, useState } from 'react';
import { Archive, Trash2, Edit3, Check, X, Sparkles, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Note, NoteLink } from '../types';
import { formatDateTime, relativeTime } from '../lib/time';
import { renderMarkdown, extractTitle } from '../lib/markdown';
import { lumen } from '../lib/api';
import { cn } from '../lib/cn';

interface Props {
  note: Note;
  onUpdate: (content: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onSelectNote: (id: number) => void;
}

export function NoteView({ note, onUpdate, onDelete, onArchive, onSelectNote }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [links, setLinks] = useState<NoteLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(note.content);
  }, [note.id]);

  useEffect(() => {
    setLoadingLinks(true);
    lumen().notes.links(note.id).then((l) => {
      setLinks(l);
      setLoadingLinks(false);
    });
  }, [note.id, note.woven, note.updatedAt]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function startEdit() { setDraft(note.content); setEditing(true); }
  async function saveEdit() {
    await onUpdate(draft);
    setEditing(false);
  }
  function cancelEdit() { setDraft(note.content); setEditing(false); }

  return (
    <motion.div
      key={note.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <article className="card p-6">
        <header className="flex items-center justify-between mb-4 text-xs text-fg-muted">
          <div className="flex items-center gap-3 selectable">
            <span>{formatDateTime(note.createdAt)}</span>
            <span className="text-fg-dim">·</span>
            <span>{relativeTime(note.updatedAt)}更新</span>
            {!note.woven && (
              <>
                <span className="text-fg-dim">·</span>
                <span className="text-accent animate-shimmer flex items-center gap-1">
                  <Sparkles size={10} /> 织网中
                </span>
              </>
            )}
          </div>
          <div className="flex gap-1">
            {editing ? (
              <>
                <button onClick={cancelEdit} className="p-1.5 hover:bg-bg-soft rounded" title="取消">
                  <X size={14} />
                </button>
                <button onClick={saveEdit} className="p-1.5 bg-accent text-black rounded" title="保存">
                  <Check size={14} />
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit} className="p-1.5 hover:bg-bg-soft rounded" title="编辑">
                  <Edit3 size={14} />
                </button>
                <button onClick={onArchive} className="p-1.5 hover:bg-bg-soft rounded" title={note.archived ? '取消归档' : '归档'}>
                  <Archive size={14} />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </header>

        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            className="w-full min-h-[200px] bg-transparent font-serif text-[15px] leading-7 focus:outline-none resize-none selectable"
          />
        ) : (
          <div
            className="prose-lumen selectable"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
          />
        )}

        {/* 标签 */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-stroke">
            {note.tags.map(tag => (
              <span key={tag.id} className={cn('chip', tag.ai_generated && 'chip-accent')}>
                🏷 {tag.name}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* 关联 */}
      {links.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3 text-sm">
            <LinkIcon size={14} className="text-accent" />
            <span className="font-semibold">让我想起你过去写的…</span>
            <span className="text-fg-dim text-xs">· AI 织网</span>
          </div>
          <div className="space-y-2">
            {links.map(link => (
              <button
                key={link.note.id}
                onClick={() => onSelectNote(link.note.id)}
                className="w-full text-left p-3 rounded-lg border border-stroke hover:border-stroke-strong hover:bg-bg-soft transition"
              >
                <div className="flex items-center gap-2 text-xs text-fg-muted mb-1">
                  <span>{relativeTime(link.note.createdAt)}</span>
                  <span className="text-fg-dim">· 相似度 {(link.similarity * 100).toFixed(0)}%</span>
                </div>
                <div className="text-sm line-clamp-2 mb-1">
                  {extractTitle(link.note.content, 80) || link.note.content.slice(0, 80)}
                </div>
                {link.reason && (
                  <div className="text-xs text-accent">🔗 {link.reason}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {!loadingLinks && links.length === 0 && note.woven && (
        <div className="text-center text-xs text-fg-dim py-4">
          暂无语义关联的笔记
        </div>
      )}

      {/* 删除确认对话框 */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm rounded-xl border border-stroke bg-bg-elev shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-400 flex-shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-fg mb-1">删除这条笔记？</h3>
                    <p className="text-sm text-fg-muted leading-relaxed">
                      此操作不可撤销。笔记及其关联的标签、嵌入和关联关系都会一并删除。
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-bg-card/40 border-t border-stroke flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-sm rounded-md hover:bg-bg-soft text-fg-muted hover:text-fg transition"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setConfirmDelete(false);
                    await onDelete();
                  }}
                  className="px-3 py-1.5 text-sm rounded-md bg-red-500/90 hover:bg-red-500 text-white font-medium transition flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
