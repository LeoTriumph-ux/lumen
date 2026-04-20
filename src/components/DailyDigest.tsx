import { useState } from 'react';
import { Sparkles, Smile, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { lumen } from '../lib/api';
import type { DailySummary } from '../types';

interface Props {
  summary: DailySummary;
  onJumpTo: (noteId: number) => void;
  onRefresh?: (s: DailySummary) => void;
}

export function DailyDigest({ summary, onJumpTo, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const isToday = summary.date === todayStr();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await lumen().digest.generate(todayStr());
      if (result && onRefresh) onRefresh(result);
    } catch {}
    setRefreshing(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-stroke bg-gradient-to-br from-bg-card to-bg-elev p-5 glow"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={14} className="text-accent" />
          <span className="font-semibold">{isToday ? '今日复盘' : '最近复盘'}</span>
          <span className="text-fg-muted text-xs selectable">· {summary.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-fg-muted hover:text-accent transition disabled:opacity-40"
            title="重新生成今日复盘"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '生成中…' : isToday ? '刷新' : '生成今日'}
          </button>
          {summary.mood && (
            <div className="flex items-center gap-1 text-xs text-fg-muted">
              <Smile size={12} />
              <span>{summary.mood}</span>
            </div>
          )}
        </div>
      </div>

      <p className="font-serif text-base leading-relaxed mb-4 selectable">
        {summary.summary}
      </p>

      {summary.highlights.length > 0 && (
        <div className="space-y-2 text-sm">
          {summary.highlights.map((h, i) => (
            <button
              key={h.noteId}
              onClick={() => onJumpTo(h.noteId)}
              className="w-full flex gap-3 items-start text-left p-2 -mx-2 rounded-md hover:bg-bg-soft transition"
            >
              <span className="text-accent font-mono text-xs mt-0.5">[{i + 1}]</span>
              <div className="flex-1">
                <div className="text-fg text-[13px]">{h.why}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
