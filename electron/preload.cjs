/**
 * Lumen · 预加载脚本
 * ─ 通过 contextBridge 暴露精简的 API 到渲染进程
 * ─ 渲染进程可用 window.lumen.* 调用
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

let askSeq = 0;
const askListeners = new Map();

ipcRenderer.on = ipcRenderer.on.bind(ipcRenderer); // noop, kept explicit

contextBridge.exposeInMainWorld('lumen', {
  // ── 笔记 ──
  notes: {
    create: (payload) => invoke('note:create', payload),
    get: (id) => invoke('note:get', id),
    update: (id, payload) => invoke('note:update', id, payload),
    remove: (id) => invoke('note:delete', id),
    archive: (id, archived = true) => invoke('note:archive', id, archived),
    list: (opts) => invoke('note:list', opts),
    search: (q, limit) => invoke('note:search', q, limit),
    stats: () => invoke('note:stats'),
    links: (id) => invoke('note:links', id),
    reweave: () => invoke('note:reweave'),
  },

  // ── Ask Lumen（流式） ──
  ask: {
    /**
     * 启动一次对话。
     * @param {string} question
     * @param {(msg: any) => void} onEvent
     * @returns {{ cancel: () => void }}
     */
    start(question, onEvent) {
      const requestId = ++askSeq;
      const channel = `ask:event:${requestId}`;
      const handler = (_e, msg) => {
        if (msg.type === 'end') {
          ipcRenderer.removeListener(channel, handler);
          askListeners.delete(requestId);
        }
        try { onEvent(msg); } catch {}
      };
      ipcRenderer.on(channel, handler);
      askListeners.set(requestId, handler);
      ipcRenderer.send('ask:start', requestId, question);
      return {
        cancel: () => ipcRenderer.send('ask:cancel', requestId),
      };
    },
  },

  // ── 对话 ──
  conv: {
    create: (title) => invoke('conv:create', title),
    list: () => invoke('conv:list'),
    messages: (id) => invoke('conv:messages', id),
    addMessage: (convId, msg) => invoke('conv:addMessage', convId, msg),
  },

  // ── 每日复盘 ──
  digest: {
    today: () => invoke('digest:today'),
    get: (date) => invoke('digest:get', date),
    generate: (date) => invoke('digest:generate', date),
  },

  // ── 设置 ──
  settings: {
    all: () => invoke('settings:all'),
    set: (key, value) => invoke('settings:set', key, value),
  },

  // ── AI 配置 ──
  ai: {
    saveConfig: (partial) => invoke('ai:saveConfig', partial),
    test: () => invoke('ai:test'),
    transcribe: (arrayBuffer, mimeType) => invoke('ai:transcribe', {
      buffer: new Uint8Array(arrayBuffer),
      mimeType,
    }),
  },

  // ── 捕捉窗口 ──
  capture: {
    close: (savedNoteId) => invoke('capture:close', savedNoteId),
    show: () => invoke('capture:show'),
  },

  // ── 窗口控制（主窗口用） ──
  win: {
    minimize: () => invoke('window:minimize'),
    maximize: () => invoke('window:maximize'),
    close: () => invoke('window:close'),
    openExternal: (url) => invoke('window:openExternal', url),
  },

  // ── 事件订阅（织网进度 / 复盘生成） ──
  on: (event, handler) => {
    const validEvents = ['weaver:start', 'weaver:done', 'weaver:error', 'digest:ready', 'notes:changed', 'capture:saved'];
    if (!validEvents.includes(event)) return () => {};
    const wrapped = (_e, payload) => handler(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
});
