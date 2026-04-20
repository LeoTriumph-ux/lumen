import { useCallback, useRef, useState } from 'react';
import { lumen } from '../lib/api';
import type { AskEvent } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citedNotes?: Array<{ id: number; content: string; similarity: number; createdAt: number }>;
  streaming?: boolean;
  error?: string;
}

/**
 * Ask Lumen 对话状态
 */
export function useAsk() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const ask = useCallback((question: string) => {
    if (!question.trim() || busy) return;
    const q = question.trim();

    setMessages(prev => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setBusy(true);

    const { cancel } = lumen().ask.start(q, (msg: AskEvent) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') return prev;

        let updated: ChatMessage;
        if (msg.type === 'context') {
          updated = { ...last, citedNotes: msg.notes };
        } else if (msg.type === 'chunk' && msg.token) {
          updated = { ...last, content: last.content + msg.token };
        } else if (msg.type === 'error') {
          updated = { ...last, error: msg.message || '未知错误', streaming: false };
        } else if (msg.type === 'done') {
          updated = { ...last, streaming: false };
        } else if (msg.type === 'end') {
          updated = { ...last, streaming: false };
          setBusy(false);
          cancelRef.current = null;
        } else {
          return prev;
        }
        return [...prev.slice(0, -1), updated];
      });
    });

    cancelRef.current = cancel;
  }, [busy]);

  const stop = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setBusy(false);
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 && m.streaming ? { ...m, streaming: false } : m
    ));
  }, []);

  const clear = useCallback(() => {
    if (busy) stop();
    setMessages([]);
  }, [busy, stop]);

  return { messages, busy, ask, stop, clear };
}
