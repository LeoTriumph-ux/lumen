/**
 * 时间工具：分组 / 格式化 / 相对时间
 */
import type { Note } from '../types';

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayStartMs(): number {
  return startOfDay(Date.now());
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} ${formatTime(ts)}`;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week} 周前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} 个月前`;
  return `${Math.floor(month / 12)} 年前`;
}

export interface NoteGroup {
  key: string;
  label: string;
  notes: Note[];
}

/**
 * 把笔记按「今天 / 昨天 / 本周 / 上周 / YYYY-MM」分组
 */
export function groupNotes(notes: Note[]): NoteGroup[] {
  const now = Date.now();
  const today = startOfDay(now);
  const yesterday = today - 24 * 3600 * 1000;
  const weekDay = new Date(now).getDay(); // 0 = Sun
  // 简化：本周 = 近 7 天（不到周一），上周 = 8-14 天
  const thisWeekStart = today - (weekDay === 0 ? 6 : weekDay - 1) * 24 * 3600 * 1000;
  const lastWeekStart = thisWeekStart - 7 * 24 * 3600 * 1000;

  const groups = new Map<string, NoteGroup>();

  const ensure = (key: string, label: string) => {
    if (!groups.has(key)) groups.set(key, { key, label, notes: [] });
    return groups.get(key)!;
  };

  for (const note of notes) {
    const t = note.createdAt;
    if (t >= today) {
      ensure('today', '今天').notes.push(note);
    } else if (t >= yesterday) {
      ensure('yesterday', '昨天').notes.push(note);
    } else if (t >= thisWeekStart) {
      ensure('this-week', '本周').notes.push(note);
    } else if (t >= lastWeekStart) {
      ensure('last-week', '上周').notes.push(note);
    } else {
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ensure(key, key).notes.push(note);
    }
  }

  // 按 order 约定的顺序：today, yesterday, this-week, last-week, YYYY-MM desc
  const order = ['today', 'yesterday', 'this-week', 'last-week'];
  const result: NoteGroup[] = [];
  for (const key of order) {
    if (groups.has(key)) result.push(groups.get(key)!);
  }
  const monthKeys = Array.from(groups.keys()).filter(k => !order.includes(k)).sort().reverse();
  for (const key of monthKeys) result.push(groups.get(key)!);
  return result;
}
