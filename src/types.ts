export type NoteType = 'thought' | 'task' | 'journal' | 'link' | 'image';

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  ai_generated: number;
}

export interface Note {
  id: number;
  content: string;
  type: NoteType;
  metadata: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  woven: boolean;
  tags: Tag[];
}

export interface NoteLink {
  similarity: number;
  reason: string | null;
  note: Note;
}

export interface Conversation {
  id: number;
  title: string | null;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  cited_notes: number[] | null;
  created_at: number;
}

export interface DailySummary {
  date: string;
  summary: string;
  highlights: Array<{ noteId: number; why: string }>;
  mood: string | null;
  created_at: number;
}

export interface Stats {
  total: number;
  woven: number;
  tags: number;
}

export interface AIConfig {
  baseUrl: string;
  chatModel: string;
  embedModel: string;
  sttModel: string;
  hasApiKey: boolean;
}

export interface AskEvent {
  type: 'context' | 'chunk' | 'done' | 'error' | 'end';
  notes?: Array<{ id: number; content: string; similarity: number; createdAt: number }>;
  token?: string;
  citedNotes?: number[];
  message?: string;
}

export interface WeaverEvent {
  noteId: number;
  tags?: string[];
  linkCount?: number;
  error?: string;
}
