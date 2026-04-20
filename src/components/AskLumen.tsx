import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAsk, type ChatMessage } from '../hooks/useAsk';
import { renderMarkdown } from '../lib/markdown';
import { relativeTime } from '../lib/time';
import { cn } from '../lib/cn';

interface Props {
  onJumpToNote: (id: number) => void;
}

export function AskLumen({ onJumpToNote }: Props) {
  const { messages, busy, ask, stop, clear } = useAsk();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function submit() {
    const q = input.trim();
    if (!q || busy) return;
    ask(q);
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  return (
    <aside className="w-[360px] border-l border-stroke bg-bg-elev flex flex-col flex-shrink-0">
      <header className="h-10 border-b border-stroke flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={14} className="text-accent" />
          <span className="font-semibold">Ask Lumen</span>
        </div>
        <button
          onClick={clear}
          className="text-fg-muted hover:text-fg p-1 rounded hover:bg-bg-soft"
          title="新对话"
          disabled={messages.length === 0}
        >
          <Trash2 size={13} />
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <IntroHints onPick={setInput} />
        ) : (
          messages.map((m, i) => (
            <MessageBubble key={i} msg={m} onJumpToNote={onJumpToNote} />
          ))
        )}
      </div>

      <div className="border-t border-stroke p-3 flex-shrink-0">
        <div className="rounded-xl border border-stroke bg-bg-card focus-within:border-accent/50 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="问点什么...（⌃↵ 发送）"
            rows={2}
            className="w-full bg-transparent text-sm p-3 resize-none focus:outline-none selectable placeholder:text-fg-dim"
          />
          <div className="flex items-center justify-between px-3 pb-2 text-xs text-fg-dim">
            <span>{input.length > 0 && `${input.length} 字`}</span>
            {busy ? (
              <button onClick={stop} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                停止
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim()}
                className="text-accent font-medium flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                发送 <Send size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function IntroHints({ onPick }: { onPick: (s: string) => void }) {
  const hints = [
    '我最近在思考什么？',
    '帮我总结这个月的想法',
    '我有没有写过类似的内容？',
  ];
  return (
    <div className="flex flex-col items-start gap-3 pt-6">
      <div className="text-xs text-fg-muted flex items-center gap-2">
        <Sparkles size={12} className="text-accent" />
        和你的笔记对话
      </div>
      <div className="w-full space-y-1.5">
        {hints.map(h => (
          <button
            key={h}
            onClick={() => onPick(h)}
            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-stroke hover:border-stroke-strong hover:bg-bg-soft transition text-fg-muted hover:text-fg"
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg, onJumpToNote }: { msg: ChatMessage; onJumpToNote: (id: number) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[85%] bg-bg-card border border-stroke rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm selectable"
        >
          {msg.content}
        </motion.div>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex"
    >
      <div className="max-w-[90%] space-y-2">
        {msg.citedNotes && msg.citedNotes.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Sparkles size={10} className="text-accent" />
            <span>读取了 {msg.citedNotes.length} 条笔记</span>
          </div>
        )}
        {msg.error ? (
          <div className="text-red-400 text-sm">⚠ {msg.error}</div>
        ) : (
          <div
            className={cn('prose-lumen text-[13.5px] leading-6 selectable', msg.streaming && 'typing-caret')}
            dangerouslySetInnerHTML={{
              __html: renderInlineCitations(renderMarkdown(msg.content), msg.citedNotes || [], onJumpToNote),
            }}
          />
        )}
        {msg.citedNotes && msg.citedNotes.length > 0 && !msg.streaming && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <AnimatePresence>
              {msg.citedNotes.map((c, i) => (
                <motion.button
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => onJumpToNote(c.id)}
                  className="chip chip-accent hover:bg-accent/20 text-[10px] cursor-pointer"
                  title={c.content}
                >
                  [{i + 1}] {relativeTime(c.createdAt)}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * 把 [1][2] 形式的引用变成可点击标签。因 HTML 已经由 marked 渲染，我们做字符串替换。
 */
function renderInlineCitations(
  html: string,
  cites: Array<{ id: number }>,
  _onJump: (id: number) => void,
): string {
  // 注意：不能在 innerHTML 内注册 onclick，需要使用 data-attr
  return html.replace(/\[(\d+)\]/g, (_m, n) => {
    const idx = Number(n) - 1;
    const cite = cites[idx];
    if (!cite) return _m;
    return `<span class="text-accent font-mono text-xs cursor-pointer hover:underline" data-cite="${cite.id}">[${n}]</span>`;
  });
}

// 委托点击引用跳转
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const el = target.closest('[data-cite]') as HTMLElement | null;
    if (el && el.dataset.cite) {
      const event = new CustomEvent('lumen:jumpToNote', { detail: { id: Number(el.dataset.cite) } });
      window.dispatchEvent(event);
    }
  });
}
