import { useCallback, useEffect, useRef, useState } from 'react';
import { lumen } from '../lib/api';
import type { Note, Stats } from '../types';

/**
 * 全局笔记列表 + 统计，订阅 weaver 事件自动刷新
 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, woven: 0, tags: 0 });
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const [list, s] = await Promise.all([
      lumen().notes.list({ limit: 500 }),
      lumen().notes.stats(),
    ]);
    setNotes(list);
    setStats(s);
    setLoading(false);
  }, []);

  const debouncedReload = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => reload(), 300);
  }, [reload]);

  useEffect(() => {
    reload();
    const offChanged = lumen().on('notes:changed', debouncedReload);
    const offDone = lumen().on('weaver:done', debouncedReload);
    const offErr = lumen().on('weaver:error', debouncedReload);
    return () => { offChanged(); offDone(); offErr(); };
  }, [reload, debouncedReload]);

  const create = useCallback(async (content: string) => {
    if (!content.trim()) return null;
    const note = await lumen().notes.create({ content });
    await reload();
    return note;
  }, [reload]);

  const update = useCallback(async (id: number, content: string) => {
    const note = await lumen().notes.update(id, { content });
    await reload();
    return note;
  }, [reload]);

  const remove = useCallback(async (id: number) => {
    await lumen().notes.remove(id);
    await reload();
  }, [reload]);

  const archive = useCallback(async (id: number, archived = true) => {
    await lumen().notes.archive(id, archived);
    await reload();
  }, [reload]);

  return { notes, stats, loading, reload, create, update, remove, archive };
}

/** 单条笔记详情 + 关联 */
export function useNoteDetail(id: number | null) {
  const [note, setNote] = useState<Note | null>(null);
  const [links, setLinks] = useState<Awaited<ReturnType<LumenAPILinks>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id == null) { setNote(null); setLinks([]); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([lumen().notes.get(id), lumen().notes.links(id)])
      .then(([n, l]) => {
        if (cancelled) return;
        setNote(n);
        setLinks(l);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  return { note, links, loading };
}

type LumenAPILinks = typeof window.lumen.notes.links;
