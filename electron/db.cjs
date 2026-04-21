/**
 * Lumen · SQLite 数据层
 * ─ 笔记、标签、关联、对话、复盘、设置
 * ─ 向量以 JSON Float32 数组形式存储，检索时在内存做余弦相似度
 * ─ 使用 better-sqlite3 同步 API（Electron 主进程内）
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const Database = require('better-sqlite3');

let db = null;

function getDbPath() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'lumen.db');
}

function init() {
  if (db) return db;
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate();
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      content     TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'thought',
      metadata    TEXT,
      embedding   TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      archived    INTEGER NOT NULL DEFAULT 0,
      wove_at     INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_wove ON notes(wove_at);

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      content, content='notes', content_rowid='id', tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.id, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT UNIQUE NOT NULL COLLATE NOCASE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id      INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      ai_generated INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS note_links (
      source_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      similarity REAL NOT NULL,
      reason     TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (source_id, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_links_source ON note_links(source_id);

    CREATE TABLE IF NOT EXISTS conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      cited_notes     TEXT,
      created_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS daily_summaries (
      date       TEXT PRIMARY KEY,
      summary    TEXT NOT NULL,
      highlights TEXT,
      mood       TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/* ────────── 笔记 CRUD ────────── */

function createNote({ content, type = 'thought', metadata = null }) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO notes (content, type, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    content,
    type,
    metadata ? JSON.stringify(metadata) : null,
    now,
    now
  );
  return getNote(info.lastInsertRowid);
}

function getNote(id) {
  const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
  if (!row) return null;
  return hydrate(row);
}

function updateNote(id, { content }) {
  const now = Date.now();
  db.prepare(`UPDATE notes SET content = ?, updated_at = ?, wove_at = NULL WHERE id = ?`)
    .run(content, now, id);
  // 内容变了，嵌入和关联需要重算
  db.prepare(`UPDATE notes SET embedding = NULL WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM note_links WHERE source_id = ? OR target_id = ?`).run(id, id);
  return getNote(id);
}

function deleteNote(id) {
  db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  return true;
}

function archiveNote(id, archived = true) {
  db.prepare(`UPDATE notes SET archived = ?, updated_at = ? WHERE id = ?`)
    .run(archived ? 1 : 0, Date.now(), id);
  return getNote(id);
}

function listNotes({ limit = 200, offset = 0, includeArchived = false } = {}) {
  const rows = db.prepare(`
    SELECT * FROM notes
    ${includeArchived ? '' : 'WHERE archived = 0'}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return rows.map(hydrate);
}

function searchNotes(query, limit = 50) {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  // FTS5 的 unicode61 tokenizer 对中文支持差（把连续中文块当一个 token），
  // 所以用 LIKE 作为主搜索路径，保证中英文、短词、部分字符都能命中。
  // 用 escape '\' 转义 SQL LIKE 的通配符以避免歧义。
  const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const rows = db.prepare(`
    SELECT * FROM notes
    WHERE archived = 0 AND content LIKE ? ESCAPE '\\'
    ORDER BY created_at DESC LIMIT ?
  `).all(`%${escaped}%`, limit);
  return rows.map(hydrate);
}

function countNotes() {
  return db.prepare(`SELECT COUNT(*) AS c FROM notes WHERE archived = 0`).get().c;
}

function countWoven() {
  return db.prepare(`SELECT COUNT(*) AS c FROM notes WHERE wove_at IS NOT NULL AND archived = 0`).get().c;
}

/* ────────── 嵌入 & 向量检索 ────────── */

function setEmbedding(id, vector) {
  if (!Array.isArray(vector)) return;
  db.prepare(`UPDATE notes SET embedding = ?, wove_at = ? WHERE id = ?`)
    .run(JSON.stringify(vector), Date.now(), id);
}

function getAllEmbeddings({ excludeId = null } = {}) {
  const rows = db.prepare(`
    SELECT id, content, embedding, created_at FROM notes
    WHERE embedding IS NOT NULL AND archived = 0
    ${excludeId ? 'AND id != ?' : ''}
  `).all(...(excludeId ? [excludeId] : []));
  return rows.map(r => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
    vector: JSON.parse(r.embedding),
  }));
}

function getUnwoven(limit = 20) {
  return db.prepare(`
    SELECT * FROM notes
    WHERE wove_at IS NULL AND archived = 0
    ORDER BY created_at ASC LIMIT ?
  `).all(limit).map(hydrate);
}

function resetWeaving() {
  db.prepare(`UPDATE notes SET wove_at = NULL WHERE archived = 0`).run();
  db.prepare(`DELETE FROM note_links`).run();
}

/* ────────── 标签 ────────── */

function upsertTag(name, color = null) {
  const existing = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(name);
  if (existing) return existing.id;
  const info = db.prepare(`INSERT INTO tags (name, color) VALUES (?, ?)`).run(name, color);
  return Number(info.lastInsertRowid);
}

function setNoteTags(noteId, tagNames, aiGenerated = true) {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM note_tags WHERE note_id = ? AND ai_generated = ?`)
      .run(noteId, aiGenerated ? 1 : 0);
    for (const name of tagNames) {
      const tagId = upsertTag(name.trim());
      db.prepare(`INSERT OR IGNORE INTO note_tags (note_id, tag_id, ai_generated) VALUES (?, ?, ?)`)
        .run(noteId, tagId, aiGenerated ? 1 : 0);
    }
  });
  tx();
}

function getNoteTags(noteId) {
  return db.prepare(`
    SELECT t.id, t.name, t.color, nt.ai_generated
    FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
    WHERE nt.note_id = ?
    ORDER BY t.name
  `).all(noteId);
}

/* ────────── 关联 ────────── */

function setNoteLinks(sourceId, links) {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM note_links WHERE source_id = ?`).run(sourceId);
    const stmt = db.prepare(`
      INSERT INTO note_links (source_id, target_id, similarity, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    for (const l of links) {
      if (l.targetId === sourceId) continue;
      stmt.run(sourceId, l.targetId, l.similarity, l.reason || null, now);
    }
  });
  tx();
}

function getNoteLinks(noteId) {
  // 双向查询：当前笔记作为源或目标的所有关联
  const links = db.prepare(`
    SELECT target_id AS otherId, similarity, reason FROM note_links WHERE source_id = ?
    UNION
    SELECT source_id AS otherId, similarity, reason FROM note_links WHERE target_id = ?
  `).all(noteId, noteId);

  if (links.length === 0) return [];

  // 去重并保留最高相似度
  const byId = new Map();
  for (const l of links) {
    const ex = byId.get(l.otherId);
    if (!ex || l.similarity > ex.similarity) byId.set(l.otherId, l);
  }

  const ids = Array.from(byId.keys());
  const placeholders = ids.map(() => '?').join(',');
  const notes = db.prepare(`
    SELECT * FROM notes WHERE id IN (${placeholders}) AND archived = 0
  `).all(...ids);

  return notes
    .map(n => {
      const link = byId.get(n.id);
      return {
        similarity: link.similarity,
        reason: link.reason,
        note: hydrate(n),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

/* ────────── 对话 ────────── */

function createConversation(title = null) {
  const now = Date.now();
  const info = db.prepare(`INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?)`)
    .run(title, now, now);
  return getConversation(info.lastInsertRowid);
}

function getConversation(id) {
  return db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
}

function listConversations(limit = 30) {
  return db.prepare(`SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?`).all(limit);
}

function addMessage(conversationId, { role, content, citedNotes = null }) {
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, cited_notes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(conversationId, role, content, citedNotes ? JSON.stringify(citedNotes) : null, now);
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);
  return db.prepare(`SELECT * FROM messages WHERE id = ?`).get(info.lastInsertRowid);
}

function getMessages(conversationId) {
  return db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
  `).all(conversationId).map(m => ({
    ...m,
    cited_notes: m.cited_notes ? JSON.parse(m.cited_notes) : null,
  }));
}

/* ────────── 每日复盘 ────────── */

function saveDailySummary(date, { summary, highlights = [], mood = null }) {
  db.prepare(`
    INSERT INTO daily_summaries (date, summary, highlights, mood, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET summary = excluded.summary,
      highlights = excluded.highlights, mood = excluded.mood
  `).run(date, summary, JSON.stringify(highlights), mood, Date.now());
  return getDailySummary(date);
}

function getDailySummary(date) {
  const row = db.prepare(`SELECT * FROM daily_summaries WHERE date = ?`).get(date);
  if (!row) return null;
  return {
    ...row,
    highlights: row.highlights ? JSON.parse(row.highlights) : [],
  };
}

function getLatestDailySummary() {
  const row = db.prepare(`SELECT * FROM daily_summaries ORDER BY date DESC LIMIT 1`).get();
  if (!row) return null;
  return { ...row, highlights: row.highlights ? JSON.parse(row.highlights) : [] };
}

function getNotesInDateRange(startMs, endMs) {
  return db.prepare(`
    SELECT * FROM notes WHERE created_at >= ? AND created_at < ? AND archived = 0
    ORDER BY created_at ASC
  `).all(startMs, endMs).map(hydrate);
}

/* ────────── 设置 ────────── */

function getSetting(key, fallback = null) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
}

function getAllSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  const result = {};
  for (const r of rows) {
    try { result[r.key] = JSON.parse(r.value); } catch { result[r.key] = r.value; }
  }
  return result;
}

/* ────────── 工具 ────────── */

function hydrate(row) {
  return {
    id: row.id,
    content: row.content,
    type: row.type,
    metadata: row.metadata ? (() => { try { return JSON.parse(row.metadata); } catch { return null; } })() : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: !!row.archived,
    woven: !!row.wove_at,
    tags: getNoteTags(row.id),
  };
}

function stats() {
  return {
    total: countNotes(),
    woven: countWoven(),
    tags: db.prepare(`SELECT COUNT(*) AS c FROM tags`).get().c,
  };
}

module.exports = {
  init, getDbPath,
  createNote, getNote, updateNote, deleteNote, archiveNote,
  listNotes, searchNotes, countNotes,
  setEmbedding, getAllEmbeddings, getUnwoven, resetWeaving,
  upsertTag, setNoteTags, getNoteTags,
  setNoteLinks, getNoteLinks,
  createConversation, getConversation, listConversations,
  addMessage, getMessages,
  saveDailySummary, getDailySummary, getLatestDailySummary, getNotesInDateRange,
  getSetting, setSetting, getAllSettings,
  stats,
};
