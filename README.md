# Lumen · 灵犀

> **想法一闪而过，Lumen 帮你记住。**
>
> 一款本地优先、AI 原生的桌面第二大脑。不做整理，只做捕捉与重新遇见。

![status](https://img.shields.io/badge/status-MVP-amber) ![platform](https://img.shields.io/badge/platform-windows-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## 哲学

传统笔记软件强迫你「整理」——建分类、起标题、打标签。这让 90% 的灵感死在录入的摩擦里。

Lumen 做相反的事：

- **写入端零摩擦**：全局快捷键 → 输入框 → 回车。
- **整理交给 AI**：后台默默生成语义嵌入、打标签、挖掘关联。
- **输出端重氛围**：时间线 × AI 对话 × 每日复盘，让你"重新遇见"过去的自己。

## 核心功能

| | 功能 | 体验 |
|---|---|---|
| ⚡ | **闪念捕捉** | `Ctrl+Alt+Space` 任何地方唤出，失焦自动关闭 |
| 🧠 | **AI 织网** | 保存后自动生成 embedding + AI 打标签 + 发现语义关联 |
| 💬 | **Ask Lumen** | 和你的笔记对话（RAG），引用真实笔记可点击跳转 |
| 📅 | **每日复盘** | 每晚定时生成一句话总结 + 亮点 + 情绪 |

## 技术栈

- **外壳**：Electron 33
- **前端**：React 19 + TypeScript + Vite 6 + Tailwind + Framer Motion
- **存储**：SQLite（better-sqlite3）+ FTS5 全文检索
- **向量**：JSON 存储 + 内存余弦相似度（适用 <10k 笔记，简单可靠）
- **AI**：任何 OpenAI 兼容 API（内置硅基流动 / DeepSeek / OpenAI / OpenRouter 预设，也支持自定义端点）

## 快速开始

```bash
# 1. 安装依赖（首次会编译 better-sqlite3 的原生模块，需要 VS Build Tools）
npm install

# 2. 开发模式（同时启动 Vite 和 Electron）
npm run dev

# 3. 打包（生成 release/ 下的 NSIS 安装包）
npm run dist
```

启动后首次使用：

1. 点击右上角「设置」或顶部横幅的「立即配置」
2. 选择 AI 服务商（推荐「硅基流动」，国内直连、价格低、支持对话+嵌入）
3. 粘贴 API Key → 保存 → 测试连接 → 看到 ✓ 即可
4. 按 `Ctrl+Alt+Space` 记下第一个想法

## 数据位置

所有数据存储在本地 SQLite 单文件：

- Windows: `%APPDATA%/Lumen/lumen.db`

数据随手复制即可备份。API Key 使用 Electron `safeStorage` 加密存储。

## 快捷键

| 快捷键 | 作用 |
|---|---|
| `Ctrl+Alt+Space` | 全局唤出闪念捕捉 |
| `Ctrl+Enter` | 保存当前编辑 |
| `Esc` | 关闭弹窗 / 捕捉窗口 |
| `Ctrl+K` | 命令面板（搜索笔记、运行命令） |
| `Ctrl+/` | 切换 Ask Lumen 侧栏 |
| `Ctrl+,` | 打开设置 |

## 项目结构

```
electron/
  main.cjs        主进程、窗口管理、IPC、全局快捷键、托盘
  preload.cjs     contextBridge 暴露 window.lumen API
  db.cjs          SQLite 迁移与 CRUD
  ai.cjs          LLM 调用、embedding、RAG 管线
  weaver.cjs      AI 织网后台工作器
  scheduler.cjs   每日复盘定时任务

src/
  App.tsx         hash 路由分发
  windows/
    MainWindow.tsx    三栏主界面
    CaptureWindow.tsx 闪念捕捉窗口
  components/
    Timeline / NoteView / DailyDigest / AskLumen /
    CommandBar / SettingsModal / EmptyState
  hooks/          useNotes / useAsk / useShortcuts / useSettings
  lib/            api.ts · time.ts · markdown.ts · cn.ts
  types.ts        全局类型
  index.css       Tailwind + 全局样式

design/
  lumen-design.md    完整设计文档
  lumen-mockup.html  可交互视觉稿
```

## 安全

- 所有 AI 请求直接从你的机器发出，Lumen 作者不经手你的数据。
- API Key 通过 `safeStorage`（Windows DPAPI）加密。
- CSP 限制渲染进程只能加载本地资源 + HTTPS。

## 路线图

当前版本为 **MVP (v0.1)**。

已完成：

- [x] 闪念捕捉 + 全局快捷键
- [x] AI 织网（embedding + 标签 + 关联）
- [x] Ask Lumen（流式 RAG 对话）
- [x] 每日复盘（定时任务，支持手动刷新）
- [x] 命令面板 + 全文搜索
- [x] 语音输入（Whisper 兼容 API）
- [x] 暗色设计系统 + 自定义对话框

发布后计划：

- [ ] 导出到 Obsidian / Logseq（批量 markdown + frontmatter）
- [ ] 端到端加密云同步（需独立后端服务）
- [ ] 移动端捕捉 App（依赖云同步先落地）
- [ ] Whisper 本地转写（`whisper.cpp` 离线模型，可断网使用）
- [ ] 插件系统

## 致谢

本项目由本人构思，AI 辅助编写。感谢 Windsurf Cascade 在架构设计、代码实现和调试过程中的全程协助。

## 许可

MIT
