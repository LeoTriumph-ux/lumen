/**
 * Lumen · 定时任务
 * ─ 每日 23:30 生成昨日复盘（可配置）
 * ─ 每小时触发一次织网回扫（捕网漏鱼）
 */
'use strict';

const cron = require('node-cron');
const db = require('./db.cjs');
const ai = require('./ai.cjs');
const weaver = require('./weaver.cjs');

let dailyTask = null;
let weaveTask = null;
let mainWindow = null;

function setMainWindow(win) { mainWindow = win; }

function emit(event, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, payload);
    }
  } catch {}
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function runDailyDigest() {
  if (!ai.hasApiKey()) return;
  // 生成"今天"的复盘（用户凌晨查看时即看到昨日）
  const date = todayStr();
  try {
    const result = await ai.generateDailyDigest(date);
    if (result) emit('digest:ready', { date, summary: result });
  } catch (e) {
    console.warn('[scheduler] daily digest failed:', e.message);
  }
}

function start() {
  stop();
  const digestTime = db.getSetting('schedule.digestTime', '23:30');
  const [hh, mm] = String(digestTime).split(':').map(Number);
  // cron: 分 时 日 月 周
  const cronExpr = `${mm || 30} ${hh || 23} * * *`;
  try {
    dailyTask = cron.schedule(cronExpr, runDailyDigest, { scheduled: true });
  } catch (e) {
    console.warn('[scheduler] invalid cron:', cronExpr, e.message);
  }
  // 每小时：回扫织网
  weaveTask = cron.schedule('0 * * * *', () => weaver.schedule(), { scheduled: true });
}

function stop() {
  if (dailyTask) { dailyTask.stop(); dailyTask = null; }
  if (weaveTask) { weaveTask.stop(); weaveTask = null; }
}

module.exports = { setMainWindow, start, stop, runDailyDigest };
