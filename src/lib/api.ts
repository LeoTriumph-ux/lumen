/**
 * 包装 window.lumen 的 typed API
 */
import type {
  Note, NoteLink, Conversation, Message, DailySummary,
  Stats, AIConfig, AskEvent, WeaverEvent,
} from '../types';

export interface LumenAPI {
  notes: {
    create: (payload: { content: string; type?: string; metadata?: any }) => Promise<Note>;
    get: (id: number) => Promise<Note | null>;
    update: (id: number, payload: { content: string }) => Promise<Note>;
    remove: (id: number) => Promise<boolean>;
    archive: (id: number, archived?: boolean) => Promise<Note>;
    list: (opts?: { limit?: number; offset?: number; includeArchived?: boolean }) => Promise<Note[]>;
    search: (q: string, limit?: number) => Promise<Note[]>;
    stats: () => Promise<Stats>;
    links: (id: number) => Promise<NoteLink[]>;
  };
  ask: {
    start: (question: string, onEvent: (msg: AskEvent) => void) => { cancel: () => void };
  };
  conv: {
    create: (title?: string | null) => Promise<Conversation>;
    list: () => Promise<Conversation[]>;
    messages: (id: number) => Promise<Message[]>;
    addMessage: (convId: number, msg: { role: 'user' | 'assistant'; content: string; citedNotes?: number[] }) => Promise<Message>;
  };
  digest: {
    today: () => Promise<DailySummary | null>;
    get: (date: string) => Promise<DailySummary | null>;
    generate: (date: string) => Promise<DailySummary | null>;
  };
  settings: {
    all: () => Promise<Record<string, any> & { 'ai.config': AIConfig }>;
    set: (key: string, value: any) => Promise<{ ok: boolean }>;
  };
  ai: {
    saveConfig: (partial: { apiKey?: string; baseUrl?: string; chatModel?: string; embedModel?: string; sttModel?: string }) => Promise<{ ok: boolean }>;
    test: () => Promise<{ ok: boolean; response?: string; error?: string }>;
    transcribe: (arrayBuffer: ArrayBuffer, mimeType: string) => Promise<{ ok: boolean; text?: string; error?: string }>;
  };
  capture: {
    close: (savedNoteId?: number) => Promise<void>;
    show: () => Promise<void>;
  };
  win: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  on: (
    event: 'weaver:start' | 'weaver:done' | 'weaver:error' | 'digest:ready' | 'notes:changed' | 'capture:saved',
    handler: (payload: WeaverEvent | { date: string; summary: DailySummary } | { type: string; id: number } | number) => void,
  ) => () => void;
}

/** 方便的全局访问器 */
export const lumen = (): LumenAPI => window.lumen;
