import { Sparkles, Key } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onNewCapture: () => void;
  onConfigureAI?: () => void;
  aiConfigured?: boolean;
}

export function EmptyState({ onNewCapture, onConfigureAI, aiConfigured }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center text-center py-24"
    >
      <div className="text-6xl text-accent mb-6 animate-shimmer">
        <Sparkles size={56} />
      </div>
      <h1 className="text-2xl font-serif mb-3">欢迎来到 Lumen</h1>
      <p className="text-fg-muted mb-8 leading-relaxed max-w-md">
        此刻，什么在你脑海？<br />
        按下 <kbd className="kbd mx-1">Ctrl</kbd>
        <kbd className="kbd mx-1">Alt</kbd>
        <kbd className="kbd mx-1">Space</kbd> 记下第一个想法。
      </p>
      <div className="flex gap-3">
        <button
          onClick={onNewCapture}
          className="px-6 py-3 bg-accent text-black font-semibold rounded-lg hover:bg-accent-strong transition"
        >
          开始捕捉 →
        </button>
        {!aiConfigured && onConfigureAI && (
          <button
            onClick={onConfigureAI}
            className="px-6 py-3 border border-stroke hover:border-accent text-fg font-medium rounded-lg transition flex items-center gap-2"
          >
            <Key size={14} />
            配置 AI
          </button>
        )}
      </div>
      <div className="mt-12 text-xs text-fg-dim">
        {aiConfigured
          ? '所有笔记存储在本地，由 AI 默默织网。'
          : '配置 AI 后即可解锁「自动织网」「Ask Lumen」「每日复盘」。'}
      </div>
    </motion.div>
  );
}
