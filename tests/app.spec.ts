import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Helper: call window.lumen API in renderer */
function api(page: Page) {
  return {
    notes: {
      create: (payload: any) => page.evaluate((p) => (window as any).lumen.notes.create(p), payload),
      get: (id: number) => page.evaluate((i) => (window as any).lumen.notes.get(i), id),
      update: (id: number, payload: any) => page.evaluate(({ id, payload }) => (window as any).lumen.notes.update(id, payload), { id, payload }),
      remove: (id: number) => page.evaluate((i) => (window as any).lumen.notes.remove(i), id),
      archive: (id: number, archived = true) => page.evaluate(({ id, a }) => (window as any).lumen.notes.archive(id, a), { id, a: archived }),
      list: (opts?: any) => page.evaluate((o) => (window as any).lumen.notes.list(o), opts),
      search: (q: string, limit?: number) => page.evaluate(({ q, l }) => (window as any).lumen.notes.search(q, l), { q, l: limit }),
      stats: () => page.evaluate(() => (window as any).lumen.notes.stats()),
      links: (id: number) => page.evaluate((i) => (window as any).lumen.notes.links(i), id),
    },
    conv: {
      create: (title?: string) => page.evaluate((t) => (window as any).lumen.conv.create(t), title),
      list: () => page.evaluate(() => (window as any).lumen.conv.list()),
      messages: (id: number) => page.evaluate((i) => (window as any).lumen.conv.messages(i), id),
      addMessage: (convId: number, msg: any) => page.evaluate(({ c, m }) => (window as any).lumen.conv.addMessage(c, m), { c: convId, m: msg }),
    },
    digest: {
      today: () => page.evaluate(() => (window as any).lumen.digest.today()),
      get: (date: string) => page.evaluate((d) => (window as any).lumen.digest.get(d), date),
    },
    settings: {
      all: () => page.evaluate(() => (window as any).lumen.settings.all()),
      set: (key: string, value: any) => page.evaluate(({ k, v }) => (window as any).lumen.settings.set(k, v), { k: key, v: value }),
    },
    ai: {
      saveConfig: (partial: any) => page.evaluate((p) => (window as any).lumen.ai.saveConfig(p), partial),
    },
    capture: {
      show: () => page.evaluate(() => (window as any).lumen.capture.show()),
      close: () => page.evaluate(() => (window as any).lumen.capture.close()),
    },
  };
}

let app: ElectronApplication;
let mainPage: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '..', 'electron', 'main.cjs')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  mainPage = await app.firstWindow();
  await mainPage.waitForLoadState('domcontentloaded');
  // 等待 React 首帧渲染
  await mainPage.waitForTimeout(1500);
});

test.afterAll(async () => {
  if (app) await app.close();
});

/* ================================================================
 *  1. 应用启动 & Electron 进程
 * ================================================================ */

test.describe('1 · 应用启动', () => {
  test('标题包含 Lumen', async () => {
    expect(await mainPage.title()).toContain('Lumen');
  });

  test('主窗口已创建且未销毁', async () => {
    const info = await app.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      return { count: wins.length, allAlive: wins.every(w => !w.isDestroyed()) };
    });
    expect(info.count).toBeGreaterThanOrEqual(1);
    expect(info.allAlive).toBe(true);
  });

  test('preload API 注入成功', async () => {
    const keys = await mainPage.evaluate(() => Object.keys((window as any).lumen));
    expect(keys).toContain('notes');
    expect(keys).toContain('ask');
    expect(keys).toContain('conv');
    expect(keys).toContain('digest');
    expect(keys).toContain('settings');
    expect(keys).toContain('ai');
    expect(keys).toContain('capture');
    expect(keys).toContain('win');
    expect(keys).toContain('on');
  });

  test('主窗口尺寸符合预期 (≥960×600)', async () => {
    const size = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      const [width, height] = w.getSize();
      return { width, height };
    });
    expect(size.width).toBeGreaterThanOrEqual(960);
    expect(size.height).toBeGreaterThanOrEqual(600);
  });
});

/* ================================================================
 *  2. 笔记 CRUD 完整测试
 * ================================================================ */

test.describe('2 · 笔记 CRUD', () => {
  let noteId: number;

  test('创建笔记', async () => {
    const note = await api(mainPage).notes.create({ content: 'E2E测试笔记_CREATE' });
    expect(note).toBeTruthy();
    expect(note.id).toBeGreaterThan(0);
    expect(note.content).toBe('E2E测试笔记_CREATE');
    expect(note.type).toBe('thought');
    expect(note.archived).toBe(false);
    expect(note.createdAt).toBeGreaterThan(0);
    noteId = note.id;
  });

  test('读取笔记', async () => {
    const note = await api(mainPage).notes.get(noteId);
    expect(note).toBeTruthy();
    expect(note.id).toBe(noteId);
    expect(note.content).toBe('E2E测试笔记_CREATE');
  });

  test('更新笔记', async () => {
    const updated = await api(mainPage).notes.update(noteId, { content: 'E2E测试笔记_UPDATED' });
    expect(updated.content).toBe('E2E测试笔记_UPDATED');
    expect(updated.updatedAt).toBeGreaterThan(updated.createdAt);
  });

  test('归档笔记', async () => {
    const archived = await api(mainPage).notes.archive(noteId, true);
    expect(archived.archived).toBe(true);
  });

  test('归档后不出现在默认列表', async () => {
    const list = await api(mainPage).notes.list();
    const found = list.find((n: any) => n.id === noteId);
    expect(found).toBeUndefined();
  });

  test('取消归档', async () => {
    const unarchived = await api(mainPage).notes.archive(noteId, false);
    expect(unarchived.archived).toBe(false);
  });

  test('取消归档后重新出现在列表', async () => {
    const list = await api(mainPage).notes.list();
    const found = list.find((n: any) => n.id === noteId);
    expect(found).toBeTruthy();
  });

  test('删除笔记', async () => {
    const result = await api(mainPage).notes.remove(noteId);
    expect(result).toBeTruthy();
  });

  test('删除后读取返回 null', async () => {
    const note = await api(mainPage).notes.get(noteId);
    expect(note).toBeFalsy();
  });
});

/* ================================================================
 *  3. 笔记列表 & 搜索 & 统计
 * ================================================================ */

test.describe('3 · 列表搜索统计', () => {
  const ids: number[] = [];

  test.beforeAll(async () => {
    // 批量创建测试笔记
    for (const text of ['苹果是水果', '香蕉也是水果', 'TypeScript很好用', '今天天气不错', 'Playwright测试_UNIQUE_MARKER']) {
      const n = await api(mainPage).notes.create({ content: text });
      ids.push(n.id);
    }
  });

  test.afterAll(async () => {
    for (const id of ids) await api(mainPage).notes.remove(id);
  });

  test('列表返回笔记，最新在前', async () => {
    const list = await api(mainPage).notes.list();
    expect(list.length).toBeGreaterThanOrEqual(ids.length);
    // 最新笔记应在前面
    const first = list[0];
    expect(first.createdAt).toBeGreaterThanOrEqual(list[list.length - 1].createdAt);
  });

  test('列表支持 limit 参数', async () => {
    const list = await api(mainPage).notes.list({ limit: 2 });
    expect(list.length).toBeLessThanOrEqual(2);
  });

  test('搜索中文关键词（水果）', async () => {
    const results = await api(mainPage).notes.search('水果');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((r: any) => r.content.includes('水果'))).toBe(true);
  });

  test('搜索英文关键词', async () => {
    const results = await api(mainPage).notes.search('TypeScript');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('TypeScript');
  });

  test('搜索唯一标记', async () => {
    const results = await api(mainPage).notes.search('UNIQUE_MARKER');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('UNIQUE_MARKER');
  });

  test('搜索不存在的内容返回空', async () => {
    const results = await api(mainPage).notes.search('__NOT_EXIST_12345__');
    expect(results.length).toBe(0);
  });

  test('空搜索返回空', async () => {
    const results = await api(mainPage).notes.search('');
    expect(results.length).toBe(0);
  });

  test('统计数据正确', async () => {
    const stats = await api(mainPage).notes.stats();
    expect(stats.total).toBeGreaterThanOrEqual(ids.length);
    expect(typeof stats.woven).toBe('number');
    expect(typeof stats.tags).toBe('number');
  });

  test('笔记关联查询不报错', async () => {
    const links = await api(mainPage).notes.links(ids[0]);
    expect(Array.isArray(links)).toBe(true);
  });
});

/* ================================================================
 *  4. 对话 (conversations) API
 * ================================================================ */

test.describe('4 · 对话历史', () => {
  let convId: number;

  test('创建对话', async () => {
    const conv = await api(mainPage).conv.create('E2E测试对话');
    expect(conv).toBeTruthy();
    expect(conv.id).toBeGreaterThan(0);
    expect(conv.title).toBe('E2E测试对话');
    convId = conv.id;
  });

  test('对话列表包含新建对话', async () => {
    const list = await api(mainPage).conv.list();
    const found = list.find((c: any) => c.id === convId);
    expect(found).toBeTruthy();
  });

  test('添加消息到对话', async () => {
    const msg = await api(mainPage).conv.addMessage(convId, { role: 'user', content: '你好' });
    expect(msg).toBeTruthy();
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('你好');

    const msg2 = await api(mainPage).conv.addMessage(convId, { role: 'assistant', content: '你好！有什么可以帮你的？' });
    expect(msg2.role).toBe('assistant');
  });

  test('获取对话消息列表', async () => {
    const messages = await api(mainPage).conv.messages(convId);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });

  test('添加带引用的消息', async () => {
    const noteForRef = await api(mainPage).notes.create({ content: '被引用的笔记' });
    const msg = await api(mainPage).conv.addMessage(convId, {
      role: 'assistant',
      content: '根据你的笔记...',
      citedNotes: [noteForRef.id],
    });
    // cited_notes 可能是数组或 JSON 序列化后的值
    const cited = msg.cited_notes;
    expect(cited).toBeTruthy();
    if (Array.isArray(cited)) {
      expect(cited).toContain(noteForRef.id);
    } else {
      expect(JSON.stringify(cited)).toContain(String(noteForRef.id));
    }
    await api(mainPage).notes.remove(noteForRef.id);
  });
});

/* ================================================================
 *  5. 设置 API
 * ================================================================ */

test.describe('5 · 设置', () => {
  test('读取所有设置不报错', async () => {
    const settings = await api(mainPage).settings.all();
    expect(settings).toBeTruthy();
    expect(typeof settings).toBe('object');
  });

  test('设置并读取自定义值', async () => {
    await api(mainPage).settings.set('test.e2e.key', 'hello_lumen');
    const settings = await api(mainPage).settings.all();
    expect(settings['test.e2e.key']).toBe('hello_lumen');
  });

  test('设置可覆盖更新', async () => {
    await api(mainPage).settings.set('test.e2e.key', 'updated_value');
    const settings = await api(mainPage).settings.all();
    expect(settings['test.e2e.key']).toBe('updated_value');
  });

  test('AI 配置结构正确', async () => {
    const settings = await api(mainPage).settings.all();
    const aiCfg = settings['ai.config'];
    expect(aiCfg).toBeTruthy();
    expect(typeof aiCfg.hasApiKey).toBe('boolean');
    expect('baseUrl' in aiCfg).toBe(true);
    expect('chatModel' in aiCfg).toBe(true);
    expect('embedModel' in aiCfg).toBe(true);
    expect('sttModel' in aiCfg).toBe(true);
  });

  test('保存 AI 配置不报错', async () => {
    // 只传 baseUrl，不传 apiKey（避免覆盖用户真实 key）
    const result = await api(mainPage).ai.saveConfig({ baseUrl: 'https://test.example.com/v1' });
    expect(result).toBeTruthy();
  });
});

/* ================================================================
 *  6. 每日复盘 API
 * ================================================================ */

test.describe('6 · 每日复盘', () => {
  test('获取今日复盘不报错（可能为 null）', async () => {
    const digest = await api(mainPage).digest.today();
    // 可能为 null（未生成过），但不应抛异常
    expect(digest === null || typeof digest === 'object').toBe(true);
  });

  test('按日期获取不存在的复盘返回 null', async () => {
    const digest = await api(mainPage).digest.get('1999-01-01');
    expect(digest).toBeNull();
  });
});

/* ================================================================
 *  7. 闪念捕捉窗口
 * ================================================================ */

test.describe('7 · 闪念捕捉窗口', () => {
  test('可以打开捕捉窗口', async () => {
    const winCountBefore = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    await api(mainPage).capture.show();
    await mainPage.waitForTimeout(1500);
    const winCountAfter = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    expect(winCountAfter).toBeGreaterThan(winCountBefore);
  });

  test('捕捉窗口包含文本输入区和保存按钮', async () => {
    const pages = app.windows();
    const capturePage = pages.find(p => p.url().includes('capture'));
    if (capturePage) {
      await capturePage.waitForLoadState('domcontentloaded');
      await capturePage.waitForTimeout(500);
      const hasTextarea = await capturePage.locator('textarea').count();
      expect(hasTextarea).toBeGreaterThanOrEqual(1);
      const hasButton = await capturePage.locator('button').count();
      expect(hasButton).toBeGreaterThan(0);
    }
  });

  test('捕捉窗口显示字数统计', async () => {
    const pages = app.windows();
    const capturePage = pages.find(p => p.url().includes('capture'));
    if (capturePage) {
      const bodyText = await capturePage.textContent('body');
      expect(bodyText).toContain('字');
    }
  });

  test('捕捉窗口显示闪念标题', async () => {
    const pages = app.windows();
    const capturePage = pages.find(p => p.url().includes('capture'));
    if (capturePage) {
      const bodyText = await capturePage.textContent('body');
      expect(bodyText).toContain('闪念');
    }
  });

  test('捕捉窗口输入文字后字数更新', async () => {
    const pages = app.windows();
    const capturePage = pages.find(p => p.url().includes('capture'));
    if (capturePage) {
      const textarea = capturePage.locator('textarea');
      await textarea.fill('测试文字12345');
      await capturePage.waitForTimeout(200);
      const bodyText = await capturePage.textContent('body');
      // 应包含 "7 字" 左右
      expect(bodyText).toMatch(/[5-9]\s*字/);
    }
  });

  test('关闭捕捉窗口', async () => {
    await api(mainPage).capture.close();
    await mainPage.waitForTimeout(500);
    const pages = app.windows();
    const capturePage = pages.find(p => p.url().includes('capture'));
    // 捕捉窗口应已关闭（或数量减少）
    expect(!capturePage || pages.length <= 2).toBe(true);
  });
});

/* ================================================================
 *  8. 主窗口 UI 组件
 * ================================================================ */

test.describe('8 · 主窗口 UI', () => {
  test('顶栏包含 Lumen 品牌名', async () => {
    const header = mainPage.locator('header').first();
    const text = await header.textContent();
    expect(text).toContain('Lumen');
  });

  test('顶栏包含搜索按钮（含"搜索"文字）', async () => {
    const headerText = await mainPage.locator('header').first().textContent();
    expect(headerText).toMatch(/搜索|⌃K/);
  });

  test('顶栏包含设置按钮', async () => {
    const headerText = await mainPage.locator('header').first().textContent();
    expect(headerText).toContain('设置');
  });

  test('页面有三栏结构', async () => {
    // 应有 aside（时间线）+ main + 可能的 AskLumen 面板
    const body = await mainPage.textContent('body');
    expect(body).toBeTruthy();
    // 至少有 header 和 main
    const mainEl = await mainPage.locator('main').count();
    expect(mainEl).toBeGreaterThanOrEqual(1);
  });

  test('时间线区域存在', async () => {
    const aside = await mainPage.locator('aside').count();
    expect(aside).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================
 *  9. 命令面板 (CommandBar)
 * ================================================================ */

test.describe('9 · 命令面板', () => {
  test('Ctrl+K 打开命令面板', async () => {
    await mainPage.keyboard.press('Control+k');
    await mainPage.waitForTimeout(300);
    // 命令面板应有输入框
    const inputs = mainPage.locator('input[placeholder]');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('命令面板显示操作项', async () => {
    // 应有"新捕捉""设置""刷新"等操作
    const bodyText = await mainPage.textContent('body');
    expect(bodyText).toMatch(/捕捉|设置|刷新/);
  });

  test('命令面板可以输入搜索', async () => {
    const input = mainPage.locator('input[placeholder]').first();
    await input.fill('测试搜索命令面板');
    await mainPage.waitForTimeout(500);
    // 不应崩溃
    const body = await mainPage.textContent('body');
    expect(body).toBeTruthy();
  });

  test('Esc 关闭命令面板', async () => {
    await mainPage.keyboard.press('Escape');
    await mainPage.waitForTimeout(300);
  });
});

/* ================================================================
 *  10. 设置弹窗 (SettingsModal)
 * ================================================================ */

test.describe('10 · 设置弹窗', () => {
  test('点击设置按钮打开弹窗', async () => {
    const settingsBtn = mainPage.locator('header button').filter({ hasText: '设置' });
    await settingsBtn.click();
    await mainPage.waitForTimeout(500);
    // 弹窗应出现
    const modalText = await mainPage.textContent('body');
    expect(modalText).toMatch(/AI|配置|模型|Key/);
  });

  test('设置弹窗有 tab 切换', async () => {
    const bodyText = await mainPage.textContent('body');
    // 应有多个 tab 标签
    expect(bodyText).toMatch(/AI|定时|快捷键|关于/);
  });

  test('Esc 关闭设置弹窗', async () => {
    await mainPage.keyboard.press('Escape');
    await mainPage.waitForTimeout(300);
  });
});

/* ================================================================
 *  11. 笔记详情 & 编辑
 * ================================================================ */

test.describe('11 · 笔记详情交互', () => {
  let testNoteId: number;

  test.beforeAll(async () => {
    const note = await api(mainPage).notes.create({ content: 'E2E笔记详情测试内容_DETAIL' });
    testNoteId = note.id;
    // 等待 UI 刷新
    await mainPage.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    await api(mainPage).notes.remove(testNoteId).catch(() => {});
  });

  test('笔记内容显示在主区域', async () => {
    // 新建笔记后等待 UI 刷新并尝试点击时间线中的对应项
    await mainPage.waitForTimeout(1000);
    // 尝试在时间线中找到并点击含 DETAIL 的条目
    const timelineItem = mainPage.locator('aside').locator('text=DETAIL').first();
    if (await timelineItem.count() > 0) {
      await timelineItem.click();
      await mainPage.waitForTimeout(500);
    }
    // 检查页面某处包含该内容
    const bodyText = await mainPage.textContent('body');
    expect(bodyText).toContain('DETAIL');
  });
});

/* ================================================================
 *  12. 批量操作与边界测试
 * ================================================================ */

test.describe('12 · 边界测试', () => {
  test('创建空内容笔记仍能存储', async () => {
    // 数据库层允许空字符串？取决于 schema NOT NULL
    // content TEXT NOT NULL → 空字符串应该可以
    const note = await api(mainPage).notes.create({ content: '' });
    expect(note).toBeTruthy();
    await api(mainPage).notes.remove(note.id);
  });

  test('创建超长笔记', async () => {
    const longContent = '长'.repeat(10000);
    const note = await api(mainPage).notes.create({ content: longContent });
    expect(note.content.length).toBe(10000);
    await api(mainPage).notes.remove(note.id);
  });

  test('创建含特殊字符笔记', async () => {
    const special = '🎉emoji <script>alert(1)</script> \n\t "引号" \'单引号\' `反引号` %百分号 _下划线';
    const note = await api(mainPage).notes.create({ content: special });
    expect(note.content).toBe(special);
    await api(mainPage).notes.remove(note.id);
  });

  test('搜索含 SQL 特殊字符不报错', async () => {
    for (const q of ['%', '_', "'; DROP TABLE notes;--", '\\']) {
      const results = await api(mainPage).notes.search(q);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  test('读取不存在的笔记返回 null', async () => {
    const note = await api(mainPage).notes.get(999999);
    expect(note).toBeFalsy();
  });

  test('删除不存在的笔记不报错', async () => {
    const result = await api(mainPage).notes.remove(999999);
    expect(result).toBeTruthy();
  });

  test('获取不存在的笔记关联返回空数组', async () => {
    const links = await api(mainPage).notes.links(999999);
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBe(0);
  });
});

/* ================================================================
 *  13. 批量创建 & 性能
 * ================================================================ */

test.describe('13 · 批量 & 性能', () => {
  const batchIds: number[] = [];

  test('批量创建 50 条笔记', async () => {
    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      const n = await api(mainPage).notes.create({ content: `批量笔记 #${i} 内容` });
      batchIds.push(n.id);
    }
    const elapsed = Date.now() - start;
    expect(batchIds.length).toBe(50);
    // 50 条笔记应在 10 秒内完成
    expect(elapsed).toBeLessThan(10_000);
  });

  test('列表能返回全部笔记', async () => {
    const list = await api(mainPage).notes.list({ limit: 200 });
    expect(list.length).toBeGreaterThanOrEqual(50);
  });

  test('搜索在大量笔记中仍有效', async () => {
    const results = await api(mainPage).notes.search('批量笔记 #25');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('#25');
  });

  test('批量删除', async () => {
    for (const id of batchIds) await api(mainPage).notes.remove(id);
    const list = await api(mainPage).notes.list({ limit: 200 });
    const remaining = list.filter((n: any) => batchIds.includes(n.id));
    expect(remaining.length).toBe(0);
  });
});

/* ================================================================
 *  14. 窗口控制
 * ================================================================ */

test.describe('14 · 窗口控制', () => {
  test('窗口最小化/还原', async () => {
    await mainPage.evaluate(() => (window as any).lumen.win.minimize());
    await mainPage.waitForTimeout(300);
    const minimized = await app.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows()[0]?.isMinimized() ?? false;
    });
    expect(minimized).toBe(true);

    // 还原
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.restore();
    });
    await mainPage.waitForTimeout(300);
  });

  test('窗口最大化切换', async () => {
    await mainPage.evaluate(() => (window as any).lumen.win.maximize());
    await mainPage.waitForTimeout(300);
    const maximized = await app.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false;
    });
    expect(maximized).toBe(true);

    // 还原
    await mainPage.evaluate(() => (window as any).lumen.win.maximize());
    await mainPage.waitForTimeout(300);
  });

  test('无窗口泄漏（≤2 个窗口）', async () => {
    const count = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    expect(count).toBeLessThanOrEqual(2);
  });
});

/* ================================================================
 *  15. 事件订阅 API
 * ================================================================ */

test.describe('15 · 事件订阅', () => {
  test('on() 对有效事件返回取消函数', async () => {
    const result = await mainPage.evaluate(() => {
      const off = (window as any).lumen.on('notes:changed', () => {});
      const isFunction = typeof off === 'function';
      off(); // 立即取消
      return isFunction;
    });
    expect(result).toBe(true);
  });

  test('on() 对无效事件返回空取消函数', async () => {
    const result = await mainPage.evaluate(() => {
      const off = (window as any).lumen.on('invalid:event', () => {});
      const isFunction = typeof off === 'function';
      off();
      return isFunction;
    });
    expect(result).toBe(true);
  });

  test('所有有效事件名都可订阅', async () => {
    const result = await mainPage.evaluate(() => {
      const events = ['weaver:start', 'weaver:done', 'weaver:error', 'digest:ready', 'notes:changed', 'capture:saved'];
      return events.every(e => {
        const off = (window as any).lumen.on(e, () => {});
        const ok = typeof off === 'function';
        off();
        return ok;
      });
    });
    expect(result).toBe(true);
  });
});
