/**
 * Lumen · 织网工作器
 * ─ 后台串行处理未织网的笔记
 * ─ 织网 = 生成 embedding + AI 打标签 + 找关联
 * ─ 用渲染进程通知事件（webContents.send）告知进度
 */
'use strict';

const db = require('./db.cjs');
const ai = require('./ai.cjs');

let running = false;
let paused = false;
let mainWindow = null;

function setMainWindow(win) { mainWindow = win; }
function pause() { paused = true; }
function resume() { paused = false; tick(); }

function emit(event, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, payload);
    }
  } catch {}
}

async function tick() {
  if (running || paused) return;
  running = true;
  try {
    while (!paused) {
      if (!ai.hasApiKey()) break;
      const batch = db.getUnwoven(1);
      if (batch.length === 0) break;
      const note = batch[0];
      emit('weaver:start', { noteId: note.id });
      try {
        const result = await ai.weaveNote(note.id);
        emit('weaver:done', { noteId: note.id, ...result });
      } catch (e) {
        emit('weaver:error', { noteId: note.id, error: e.message });
        // 标记为已织网，避免死循环（但不会更新标签/关联）
        db.setEmbedding(note.id, []);
      }
      // 节流：每条笔记间隔 600ms，避免 API 限流
      await new Promise(r => setTimeout(r, 600));
    }
  } finally {
    running = false;
  }
}

/** 唤起处理队列（防抖） */
let pending = null;
function schedule() {
  if (pending) return;
  pending = setTimeout(() => { pending = null; tick(); }, 1500);
}

/** 立即处理一条新笔记 */
async function processOne(noteId) {
  if (!ai.hasApiKey()) return;
  try {
    emit('weaver:start', { noteId });
    const result = await ai.weaveNote(noteId);
    emit('weaver:done', { noteId, ...result });
  } catch (e) {
    emit('weaver:error', { noteId, error: e.message });
    db.setEmbedding(noteId, []);
  }
}

module.exports = { setMainWindow, pause, resume, schedule, tick, processOne };
