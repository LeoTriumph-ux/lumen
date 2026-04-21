/**
 * Lumen · 主进程入口
 * ─ 创建主窗口（三栏 UI）
 * ─ 创建闪念捕捉窗口（按全局快捷键唤出）
 * ─ 系统托盘 · 全局快捷键 · IPC handler 注册
 */
'use strict';

const {
  app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage,
  screen, shell,
} = require('electron');
const path = require('path');
const fs = require('fs');

const db = require('./db.cjs');
const ai = require('./ai.cjs');
const weaver = require('./weaver.cjs');
const scheduler = require('./scheduler.cjs');

const isDev = process.env.NODE_ENV === 'development';
const DEV_URL = 'http://localhost:5173';

function getIconPath(name) {
  if (isDev) return path.join(__dirname, '..', 'public', name);
  return path.join(process.resourcesPath, name);
}

let mainWindow = null;
let captureWindow = null;
let tray = null;

/* ──────────────────────── 窗口 ──────────────────────── */

function getPreloadPath() {
  return path.join(__dirname, 'preload.cjs');
}

function loadRendererURL(win, params = '') {
  if (isDev) {
    win.loadURL(`${DEV_URL}${params}`);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    // Use loadFile + query hash so production single-page bundle routes correctly
    win.loadFile(indexPath, { hash: params.replace(/^#/, '') });
  }
}

function createMainWindow() {
  const iconPath = getIconPath('icon.ico');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    icon: iconPath,
    backgroundColor: '#0a0a0a',
    title: 'Lumen',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#ededed',
      height: 40,
    },
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  loadRendererURL(mainWindow, '#/main');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    // 最小化到托盘（除非用户真的退出）
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // 开发时按 F12 手动打开 DevTools
  // if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  weaver.setMainWindow(mainWindow);
  scheduler.setMainWindow(mainWindow);
}

function createCaptureWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();

  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show();
    captureWindow.focus();
    return;
  }

  // 屏幕中心上方 1/3 位置
  const { workArea } = screen.getPrimaryDisplay();
  const width = 640, height = 240;
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + workArea.height * 0.25);

  captureWindow = new BrowserWindow({
    width, height, x, y,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  loadRendererURL(captureWindow, '#/capture');

  captureWindow.once('ready-to-show', () => {
    captureWindow.setAlwaysOnTop(true, 'screen-saver');
    captureWindow.show();
    captureWindow.focus();
  });

  captureWindow.on('closed', () => { captureWindow = null; });
}

/* ──────────────────────── 托盘 ──────────────────────── */

function createTray() {
  const trayIconPath = getIconPath('icon.png');
  let icon = nativeImage.createEmpty();
  if (fs.existsSync(trayIconPath)) icon = nativeImage.createFromPath(trayIconPath);
  if (icon.isEmpty()) {
    // 生成 16x16 纯色占位图标
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAK0lEQVQ4T2NkYGD4z0ABYBxVQH4IjAaAYQwYDYCxGwGEKjDqAYY3AOgYABQAAoBbIh4AaDwAAAAASUVORK5CYII='
    );
  }
  tray = new Tray(icon);
  tray.setToolTip('Lumen · 灵犀');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '新捕捉', accelerator: 'CmdOrCtrl+Alt+Space', click: createCaptureWindow },
    { label: '打开 Lumen', click: () => { if (mainWindow) mainWindow.show(); else createMainWindow(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

/* ──────────────────────── 全局快捷键 ──────────────────────── */

function registerShortcuts() {
  const accel = db.getSetting('shortcut.capture', 'CommandOrControl+Alt+Space');
  try {
    globalShortcut.register(accel, createCaptureWindow);
  } catch (e) {
    console.warn('[main] failed to register shortcut:', accel, e.message);
  }
}

/* ──────────────────────── IPC handler ──────────────────────── */

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try { win.webContents.send(channel, payload); } catch {}
  }
}

function registerIpc() {
  // ── 笔记 CRUD ──
  ipcMain.handle('note:create', (_e, payload) => {
    const note = db.createNote(payload);
    broadcast('notes:changed', { type: 'create', id: note.id });
    // 异步织网（AI 未配置时 weaver.processOne 会跳过）
    setImmediate(() => weaver.processOne(note.id));
    return note;
  });
  ipcMain.handle('note:get', (_e, id) => db.getNote(id));
  ipcMain.handle('note:update', (_e, id, payload) => {
    const note = db.updateNote(id, payload);
    broadcast('notes:changed', { type: 'update', id });
    setImmediate(() => weaver.processOne(id));
    return note;
  });
  ipcMain.handle('note:delete', (_e, id) => {
    const r = db.deleteNote(id);
    broadcast('notes:changed', { type: 'delete', id });
    return r;
  });
  ipcMain.handle('note:archive', (_e, id, archived) => {
    const r = db.archiveNote(id, archived);
    broadcast('notes:changed', { type: 'archive', id });
    return r;
  });
  ipcMain.handle('note:list', (_e, opts) => db.listNotes(opts || {}));
  ipcMain.handle('note:search', (_e, q, limit) => db.searchNotes(q, limit));
  ipcMain.handle('note:stats', () => db.stats());
  ipcMain.handle('note:links', (_e, id) => db.getNoteLinks(id));
  ipcMain.handle('note:reweave', () => {
    db.resetWeaving();
    weaver.schedule();
    return { ok: true };
  });

  // ── Ask Lumen（流式） ──
  const askControllers = new Map();
  ipcMain.on('ask:start', async (event, requestId, question) => {
    const controller = new AbortController();
    askControllers.set(requestId, controller);
    try {
      for await (const msg of ai.askLumen({ question, signal: controller.signal })) {
        if (controller.signal.aborted) break;
        event.sender.send(`ask:event:${requestId}`, msg);
      }
    } catch (e) {
      event.sender.send(`ask:event:${requestId}`, { type: 'error', message: e.message });
    } finally {
      askControllers.delete(requestId);
      event.sender.send(`ask:event:${requestId}`, { type: 'end' });
    }
  });
  ipcMain.on('ask:cancel', (_e, requestId) => {
    const ctrl = askControllers.get(requestId);
    if (ctrl) ctrl.abort();
  });

  // ── 对话历史 ──
  ipcMain.handle('conv:create', (_e, title) => db.createConversation(title));
  ipcMain.handle('conv:list', () => db.listConversations());
  ipcMain.handle('conv:messages', (_e, id) => db.getMessages(id));
  ipcMain.handle('conv:addMessage', (_e, convId, msg) => db.addMessage(convId, msg));

  // ── 每日复盘 ──
  ipcMain.handle('digest:today', () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return db.getDailySummary(today) || db.getLatestDailySummary();
  });
  ipcMain.handle('digest:get', (_e, date) => db.getDailySummary(date));
  ipcMain.handle('digest:generate', async (_e, date) => {
    return await ai.generateDailyDigest(date);
  });

  // ── 设置 / AI 配置 ──
  ipcMain.handle('settings:all', () => {
    const s = db.getAllSettings();
    // 不返回原 key（隐私），只返回是否已配置
    const aiCfg = ai.getConfig();
    return {
      ...s,
      'ai.config': {
        baseUrl: aiCfg.baseUrl,
        chatModel: aiCfg.chatModel,
        embedModel: aiCfg.embedModel,
        sttModel: aiCfg.sttModel,
        hasApiKey: !!aiCfg.apiKey,
      },
    };
  });
  ipcMain.handle('settings:set', (_e, key, value) => {
    db.setSetting(key, value);
    if (key === 'shortcut.capture') {
      globalShortcut.unregisterAll();
      registerShortcuts();
    }
    if (key === 'schedule.digestTime') {
      scheduler.start();
    }
    return { ok: true };
  });
  ipcMain.handle('ai:saveConfig', (_e, partial) => ai.saveConfig(partial));
  ipcMain.handle('ai:test', () => ai.testConnection());
  ipcMain.handle('ai:transcribe', async (_e, { buffer, mimeType }) => {
    try {
      const text = await ai.transcribe(Buffer.from(buffer), mimeType);
      return { ok: true, text };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 捕捉窗口专属 ──
  ipcMain.handle('capture:close', (_e, savedNoteId) => {
    if (captureWindow && !captureWindow.isDestroyed()) captureWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      if (savedNoteId) {
        mainWindow.webContents.send('capture:saved', savedNoteId);
      }
    }
  });
  ipcMain.handle('capture:show', createCaptureWindow);

  // ── 主窗口操作 ──
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:openExternal', (_e, url) => shell.openExternal(url));
}

/* ──────────────────────── 生命周期 ──────────────────────── */

app.whenReady().then(() => {
  db.init();

  // 允许麦克风权限（用于 Whisper 语音输入）
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture');
  });

  registerIpc();
  createMainWindow();
  createTray();
  registerShortcuts();
  scheduler.start();
  weaver.schedule();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  // 不退出，保留托盘
  if (process.platform !== 'darwin' && app.isQuitting) app.quit();
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  scheduler.stop();
});
