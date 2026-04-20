# Lumen · 灵犀 — 设计文档 v0.1

> 一款**本地优先**、**AI 原生**的桌面「第二大脑」。  
> 口号：**想法一闪而过，Lumen 帮你记住。**

---

## 一、产品定位

### 核心矛盾
传统笔记 App 强迫你「整理」——建分类、打标签、起标题。但 **人脑的灵感是流动的、碎片的、无结构的**。整理的摩擦让 90% 的灵感死在路上。

### Lumen 的解法
- **写入端零摩擦**：全局快捷键 → 一个输入框 → 回车。不问标题，不问分类。
- **整理交给 AI**：后台异步打标签、找关联、写摘要。
- **输出端重氛围**：时间线 + AI 对话 + 每日复盘，让你「重新遇见」过去的自己。

### 不做什么
- ❌ 不做知识图谱可视化（花哨但无用）
- ❌ 不做协作/分享（个人工具）
- ❌ 不做富文本表格/看板（那是 Notion 的事）
- ❌ 不做云同步 v1（本地优先，v2 再说端到端加密同步）

---

## 二、核心功能（4 个，少而精）

### ① 闪念捕捉 Quick Capture
- 全局快捷键 `Ctrl+Alt+Space`（任何应用中可触发）
- 屏幕中央弹出半透明迷你窗口（600×200）
- 输入框自动 focus，支持粘贴图片、拖入文件
- `Ctrl+Enter` 保存 / `Esc` 取消 / 失焦自动保存
- 保存后窗口淡出（200ms），**不打断工作流**

### ② AI 织网 Auto-weave
保存后异步触发（用户无感）：
1. **Embedding**：调用 `text-embedding-3-small` 生成向量存入 SQLite
2. **标签生成**：AI 读内容生成 1-3 个标签（复用已有标签优先）
3. **关联发现**：向量相似度找 top-3 历史笔记，AI 判断是否真相关并写出「关联理由」
4. 在时间线笔记卡片下方以「💡 让我想起你 3 周前写的…」形式提示

### ③ 对话你的笔记 Ask Lumen
- 右侧对话栏，输入自然语言问题
- 后台：embedding 检索 top-K（默认 8）相关笔记 → 拼接为上下文 → 调用 LLM
- 流式输出，引用笔记以 `[1]` `[2]` 标注，可点击跳转
- 典型提问：
  - 「我上个月对 Electron 的看法是什么？」
  - 「帮我总结一下最近关于创业的想法」
  - 「我有没有写过关于 SQLite 的笔记？」

### ④ 每日复盘 Daily Digest
- 每日 23:30 后台触发（可在设置中调整时间/关闭）
- AI 读取当天所有笔记 → 生成：
  - 一句话总结（不超过 40 字）
  - 3 个亮点（引用具体笔记）
  - 情绪/主题趋势（可选）
- 次日打开主窗口首屏即是昨日复盘卡片
- 每周日额外生成「周报」

---

## 三、UI 设计

### 主窗口（1200×800 默认）

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✦ Lumen                    ⌘K 搜索              🌙  ⚙️  ─ □ ✕     │  40px top bar
├─────────────────┬───────────────────────────────┬──────────────────┤
│                 │                               │                  │
│  ✚ 新捕捉      │   ╭─ 昨日复盘 ──────╮         │  ✦ Ask Lumen    │
│                 │   │ AI: 你在思考... │         │                  │
│  今天 · 4       │   │ • 亮点 1       │         │  [对话历史]      │
│   ▸ 21:18      │   │ • 亮点 2       │         │                  │
│   ▸ 19:42      │   ╰─────────────────╯         │  [流式回答...]  │
│   ▸ 15:03      │                               │                  │
│   ▸ 09:11      │   ┌─ 2026-04-20 21:18 ──┐    │                  │
│                 │   │                      │    │                  │
│  昨天 · 7       │   │  # 关于 SQLite      │    │                  │
│   ▸ 23:11      │   │  今天发现 sqlite... │    │                  │
│   ▸ 19:30      │   │                      │    │                  │
│   ...           │   │  🏷 数据库 · 技术    │    │                  │
│                 │   │                      │    │                  │
│  本周 · 23      │   │  💡 关联            │    │                  │
│  上周 · 31      │   │  → 3 周前:「考虑... │    │                  │
│                 │   └──────────────────────┘    │                  │
│                 │                               │  ╭──────────╮    │
│  2026-03        │                               │  │ 问点什么 │    │
│  2026-02        │                               │  ╰──────────╯    │
│                 │                               │                  │
└─────────────────┴───────────────────────────────┴──────────────────┘
   280px              flex                           360px（可折叠）
```

### 闪念捕捉窗口（600×200，屏幕居中，置顶，半透明）

```
╭────────────────────────────────────────────╮
│  ✦  闪念                             Esc   │  24px
├────────────────────────────────────────────┤
│                                            │
│   |  （输入框，自动 focus）               │  flex
│                                            │
├────────────────────────────────────────────┤
│  📎 拖入文件    📷 截图    ⌘↵ 保存        │  32px
╰────────────────────────────────────────────╯
```

### 命令面板（`Ctrl+K`）

```
╭────────────────────────────────────────────╮
│  🔍  搜索笔记或执行命令...                │
├────────────────────────────────────────────┤
│  ➤ 新建闪念                                │
│  ➤ 跳转到今日复盘                          │
│  ➤ 导出全部笔记                            │
│ ─────────────────────────────────────────  │
│  📝  关于 SQLite               21:18       │
│  📝  Electron 打包问题          昨天        │
│  📝  创业想法：AI 工作流       3 天前      │
╰────────────────────────────────────────────╯
```

### 视觉语言
- **配色（暗色优先）**
  - 背景：`#0a0a0a` / `#121212`
  - 卡片：`#1a1a1a` / `#222222`
  - 主色：`#f5c542`（琥珀金，呼应 Lumen 的「光」意象）
  - 文字：`#ededed` / `#8a8a8a`（次级）
  - 边框：`#2a2a2a`
- **字体**
  - UI：Inter / 思源黑体
  - 正文：Source Serif Pro / 思源宋体（阅读更友好）
  - 代码：JetBrains Mono
- **动效**（Framer Motion）
  - 捕捉窗口弹出：fade + scale(0.95→1)，200ms
  - 笔记卡片：列表进入 stagger 30ms
  - 对话气泡：从下淡入
- **灵魂细节**
  - 空状态插画：点点星光 + 「此刻，什么在你脑海？」
  - 保存成功：右下角一个小小的 ✦ 闪一下

---

## 四、数据库设计（SQLite）

```sql
-- 笔记本体
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT NOT NULL,                -- markdown
  type        TEXT DEFAULT 'thought',       -- thought | task | journal | link | image
  metadata    JSON,                         -- { url?, image_path?, source? }
  created_at  INTEGER NOT NULL,             -- unix ms
  updated_at  INTEGER NOT NULL,
  archived    INTEGER DEFAULT 0
);
CREATE INDEX idx_notes_created ON notes(created_at DESC);

-- 全文检索
CREATE VIRTUAL TABLE notes_fts USING fts5(
  content, content='notes', content_rowid='id',
  tokenize='porter unicode61'
);

-- 向量检索 (sqlite-vss)
CREATE VIRTUAL TABLE notes_vss USING vss0(embedding(1536));

-- AI 生成的标签
CREATE TABLE tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE note_tags (
  note_id      INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  tag_id       INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  ai_generated INTEGER DEFAULT 1,
  PRIMARY KEY (note_id, tag_id)
);

-- 笔记间的 AI 关联
CREATE TABLE note_links (
  source_id  INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  target_id  INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  similarity REAL NOT NULL,
  reason     TEXT,                          -- AI 写的关联理由
  created_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, target_id)
);

-- 对话历史
CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,            -- user | assistant
  content         TEXT NOT NULL,
  cited_notes     JSON,                     -- [note_id, ...]
  created_at      INTEGER NOT NULL
);

-- 每日复盘
CREATE TABLE daily_summaries (
  date       TEXT PRIMARY KEY,              -- YYYY-MM-DD
  summary    TEXT NOT NULL,
  highlights JSON,                          -- [note_id, ...]
  mood       TEXT,                          -- 可选情绪标签
  created_at INTEGER NOT NULL
);

-- 设置
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 五、文件结构

```
Shadow Box/   （后续 rename 为 lumen）
├── electron/
│   ├── main.cjs              - 主进程、托盘、全局快捷键、窗口管理
│   ├── preload.cjs           - contextBridge 暴露 window.lumen API（~15 个）
│   ├── db.cjs                - SQLite 封装 + 迁移
│   ├── ai.cjs                - LLM 调用 + embedding + RAG pipeline
│   ├── capture.cjs           - 闪念捕捉窗口的创建与生命周期
│   ├── scheduler.cjs         - node-cron 定时任务（每日复盘、AI 织网）
│   └── weaver.cjs            - AI 织网工作器（队列 + 限流）
├── src/
│   ├── main.tsx              - 主窗口入口
│   ├── capture.tsx           - 捕捉窗口入口（独立 HTML）
│   ├── App.tsx               - 三栏布局
│   ├── components/
│   │   ├── Timeline.tsx      - 左侧时间线
│   │   ├── NoteList.tsx      - 笔记列表
│   │   ├── NoteCard.tsx      - 单个笔记卡片
│   │   ├── NoteEditor.tsx    - Tiptap 编辑器
│   │   ├── DailyDigest.tsx   - 每日复盘卡片
│   │   ├── RelatedNotes.tsx  - 关联笔记
│   │   ├── AskLumen.tsx      - 右侧对话栏
│   │   ├── CommandBar.tsx    - ⌘K 命令面板
│   │   ├── Capture.tsx       - 闪念窗口 UI
│   │   └── Settings.tsx      - 设置弹窗
│   ├── hooks/
│   │   ├── useNotes.ts       - 笔记 CRUD
│   │   ├── useAsk.ts         - AI 对话
│   │   └── useShortcuts.ts   - 应用内快捷键
│   ├── lib/
│   │   ├── api.ts            - window.lumen 类型封装
│   │   ├── markdown.ts       - 渲染
│   │   └── time.ts           - 时间分组（今天/昨天/本周）
│   └── styles/
│       └── globals.css
├── design/
│   ├── lumen-design.md       - 本文档
│   └── lumen-mockup.html     - 可交互视觉稿
└── docs/
    └── keybindings.md        - 快捷键速查表
```

---

## 六、技术栈决策

| 领域 | 选型 | 理由 |
|---|---|---|
| 桌面壳 | Electron（保留） | 现有打包/更新基建可复用 |
| 前端 | React 19 + TypeScript + Vite | 保留现有 |
| 样式 | Tailwind CSS | 保留现有 |
| 动效 | Framer Motion | 保留现有 |
| 编辑器 | **Tiptap** | ProseMirror 基础，扩展性强，中文输入无坑 |
| 本地存储 | **better-sqlite3** | 同步 API、零配置、嵌入式 |
| 向量检索 | **sqlite-vec**（新，取代 vss） | 官方推荐，支持 Windows |
| 嵌入模型 | text-embedding-3-small（默认） | 便宜、效果够；可切本地 Ollama |
| LLM | OpenAI-compatible | 复用现有 `ai.cjs` 骨架 |
| 定时任务 | node-cron | 轻量 |
| 快捷键 | electron globalShortcut | 系统级 |

---

## 七、快捷键

| 快捷键 | 作用 | 作用域 |
|---|---|---|
| `Ctrl+Alt+Space` | 唤出闪念捕捉窗口 | **全局** |
| `Ctrl+Enter` | 保存当前捕捉 | 捕捉窗口 |
| `Esc` | 关闭捕捉窗口 | 捕捉窗口 |
| `Ctrl+K` | 命令面板 | 主窗口 |
| `Ctrl+F` | 搜索笔记 | 主窗口 |
| `Ctrl+/` | 切换 Ask Lumen 侧栏 | 主窗口 |
| `Ctrl+D` | 跳转到今日 | 主窗口 |
| `Ctrl+,` | 打开设置 | 主窗口 |

---

## 八、需要删除的内容（旧版 Shadow Box）

### 删除的 Electron 模块
- `electron/gbox.cjs` —— G-Box 压缩
- `electron/server.cjs` —— Magic Portal
- `electron/register.cjs` —— 注册表集成
- `electron/pty.cjs` / 终端相关
- `electron/algorithms/` —— 整个文件夹（分类/相似度/搜索/去重）
- `electron/handlers/` —— 整个文件夹（fsHandlers/dataHandlers/featureHandlers）
- `electron/plugins/` —— 旧插件
- FTP/SFTP/WebDAV/加密/图像处理/哈希链 相关

### 删除的前端
- 所有文件管理器组件（FileList、DualPane、TabBar 等）
- 旧 `App.tsx` 整体重写
- 旧 `src/hooks/` 中与文件操作相关的 hook
- `src/data/plugins.ts` 及插件注册表

### 保留 / 沿用
- Vite / TypeScript / Tailwind / Framer Motion / Vitest 配置
- electron-builder 打包配置
- `ai.cjs` 的 OpenAI-compatible 调用骨架（重写但借鉴）
- `.env.example`、README 基础结构

### 新增依赖（package.json）
```json
{
  "dependencies": {
    "better-sqlite3": "^11.x",
    "sqlite-vec": "^0.1.x",
    "@tiptap/react": "^2.x",
    "@tiptap/starter-kit": "^2.x",
    "node-cron": "^3.x",
    "date-fns": "^4.x"
  }
}
```

---

## 九、核心用户流

### Flow 1：首次启动
1. 欢迎页 → 选择语言 → 配置 AI（API Key 或选本地 Ollama）
2. 测试 API 可用性 → 完成
3. 进入主窗口，空状态：「按 `Ctrl+Alt+Space` 记下第一个想法」

### Flow 2：日常捕捉
```
用户按 Ctrl+Alt+Space
  ↓
捕捉窗口弹出（fade + scale）
  ↓
用户输入「今天学会了 SQLite FTS5，超酷」
  ↓
Ctrl+Enter 保存
  ↓
窗口淡出（200ms）
  ↓ [后台异步]
Weaver: 生成 embedding → 打标签 [数据库, 学习] → 找关联
  ↓
主窗口下次打开时：时间线新增一条，带标签 + 关联
```

### Flow 3：复盘
```
次日打开主窗口
  ↓
首屏昨日复盘卡片
「你昨天的 4 条笔记围绕『学习新工具』，
 亮点：[1] SQLite FTS5 [2] … [3] …」
  ↓
用户点击 [1] → 跳转到那条笔记
  ↓
笔记下方显示 3 周前的相关笔记，用户恍然大悟
```

### Flow 4：对话检索
```
用户在右侧输入「我对 SQLite 的看法」
  ↓
后台：embedding("我对 SQLite 的看法") → vss 找 top 8 笔记
  ↓
拼接 prompt：「用户问：... 以下是相关笔记：[1]... [2]...」
  ↓
LLM 流式回答，引用 [1][2]
  ↓
用户点击引用 → 打开对应笔记
```

---

## 十、MVP 里程碑

### M1 地基（2-3 天）
- [ ] 清理旧代码
- [ ] 新依赖安装 + SQLite 迁移
- [ ] 主窗口三栏布局骨架
- [ ] 闪念窗口 + 全局快捷键
- [ ] 笔记 CRUD + 时间线

### M2 AI 织网（2 天）
- [ ] Embedding 生成 + sqlite-vec 写入
- [ ] AI 打标签
- [ ] 关联发现 + 理由生成
- [ ] 笔记卡片显示关联

### M3 Ask Lumen（1-2 天）
- [ ] 右侧对话栏 UI
- [ ] RAG pipeline（检索 → 拼 prompt → 流式）
- [ ] 引用跳转

### M4 每日复盘 + 打磨（1-2 天）
- [ ] node-cron 定时任务
- [ ] 复盘生成
- [ ] 首屏复盘卡片
- [ ] 命令面板 `Ctrl+K`
- [ ] 设置页
- [ ] 空状态 / 动效打磨

### M5 收官（1 天）
- [ ] 数据导出（JSON / Markdown）
- [ ] README 重写
- [ ] 打包测试

**总计：7-10 天可达到可用 MVP。**

---

## 十一、未来可能（v2+ 不做）

- 端到端加密云同步
- iOS / Android 捕捉 App（通过同步对接）
- 语音输入 + Whisper 本地转写
- 导出到 Obsidian / Logseq
- 多语言 AI 模型配置
- 插件系统
