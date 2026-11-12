# 今日 · 待办与日历

一个为 iPhone 设计的本地优先待办清单 + 周历 PWA。没有账号、没有服务器，任务保存在浏览器本地；添加到主屏幕后可以像 App 一样全屏使用，也能离线打开。

![今日预览](docs/preview.png)

## 功能

- **今日视图**：顺延任务、今日任务、完成进度、已完成折叠
- **周历视图**：周条切换、日期圆点、按天查看和添加任务，支持左右滑动换周
- **收件箱**：先记录、后安排日期
- **快速添加**：中文自然语言解析日期 / 时间 / 时长 / 标签
  - 例：`明天下午3点和张三开会 30分钟 #工作`
  - 支持：今天 / 明天 / 后天、周X / 下周X、X月X日、上午9点 / 15:30、半小时 / 1小时 / 30分钟、`#标签`
- **任务字段**：日期、时间、时长、优先级、重复（每天 / 每周 / 工作日）、标签、子任务、备注
- **重复任务**：完成后自动生成下一次
- **顺延**：未完成的历史任务会出现在今日视图，可一键移到今天
- **外观**：浅色 / 深色 / 跟随系统，适配 iPhone 安全区
- **数据**：JSON 导出 / 导入备份；导出 `.ics` 到苹果日历
- **PWA**：可安装、离线可用

## 开始使用

```bash
npm install
npm run dev
```

打开 http://localhost:5173 。

构建与本地预览：

```bash
npm run build
npm run preview
```

## 部署到 iPhone

任意支持 HTTPS 的静态托管都可以。构建命令 `npm run build`，输出目录 `dist`。

部署后用 iPhone Safari 打开网址 → 分享 →「添加到主屏幕」。

### GitHub Pages

仓库已内置 `.github/workflows/deploy.yml`，推送到 `main` 后会自动构建并发布：

1. 新建 GitHub 仓库（免费账号需要公开仓库），把代码推到默认分支 `main`
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**
3. 等待 Actions 里的 “Deploy to GitHub Pages” 完成
4. 访问 `https://<用户名>.github.io/<仓库名>/`

工作流会通过 `actions/configure-pages` 自动取得子路径，并注入 `VITE_BASE_PATH`；manifest 的 `start_url` / `scope` 也会跟着调整。工作流同时监听 `main` / `master` 两个分支。

> 国内访问 `github.io` 可能不稳定；必要时换 Cloudflare Pages 或腾讯 EdgeOne Pages。

### 其他平台

- **Cloudflare Pages**：Workers & Pages → Create → Pages → Upload assets，把 `dist` 拖进去
- **EdgeOne Pages（腾讯）**：国内访问更友好，上传 `dist` 或连接仓库
- **Vercel / Netlify**：导入项目或拖拽 `dist`

子路径部署可以手动指定：

```powershell
$env:VITE_BASE_PATH='/myday/'
npm run build
```

不设置时默认根路径 `/`。

> iOS 上，主屏幕版本与 Safari 可能使用相互独立的本地存储。建议先「添加到主屏幕」，再从主屏幕开始记录；如果已经在 Safari 里录入过数据，先在设置里导出备份，再在主屏幕版本中导入。

## 数据与备份

- 数据保存在浏览器的 IndexedDB 中，只在本机
- **设置 → 导出备份**：生成 JSON；在 iPhone 上会打开分享面板，可存到「文件」
- **设置 → 导入备份**：覆盖当前数据，并会先弹窗确认
- **设置 → 导出日历**：生成 `.ics`，可在「文件」中点开导入苹果日历
- 清理 Safari 网站数据会删除任务，建议偶尔导出备份

### 关于提醒

iOS 上的 PWA 没有本地定时通知能力。当前版本不做系统级提醒，有两种替代：

1. 用「导出日历」生成 `.ics`，导入苹果日历后用日历提醒；适合时间固定的任务
2. 后续加一个很小的 Cloudflare Worker + Web Push（iOS 16.4+，且必须先添加到主屏幕）

## 技术栈

- Vite + React 19 + TypeScript
- Dexie（IndexedDB）
- date-fns
- lucide-react
- vite-plugin-pwa（Workbox）

## 目录

```
src/
  App.tsx              应用外壳、tab、任务弹层调度
  db.ts                Dexie 数据层、增删改、重复任务生成
  types.ts             任务类型
  lib/
    dates.ts           日期与排序工具
    parse.ts           中文快速添加解析
    backup.ts          JSON 备份 / 导入 / .ics 导出
    ics.ts             iCalendar 生成
    files.ts           iOS 分享面板 / 文件下载
    theme.ts           主题持久化
  components/          TabBar、TaskItem、TaskSheet、WeekStrip 等
  views/               今日 / 日历 / 收件箱 / 设置
scripts/
  generate-icons.mjs   从 SVG 生成 PWA 图标
  ui-check.mjs         端到端 UI 自测（需 dev server）
  pwa-check.mjs        PWA / 离线自测（需 preview server）
.github/workflows/
  deploy.yml           GitHub Pages 自动部署
```

## 自测

启动 dev server 后：

```bash
node scripts/ui-check.mjs
```

覆盖自然语言解析、任务创建、顺延、重复任务、收件箱、深色模式、JSON 导入导出、ICS 导出。

PWA 检查：

```bash
npm run build
npm run preview
node scripts/pwa-check.mjs
```

检查 manifest、图标、Service Worker 注册与离线打开。

## 后续可以做

- 月视图、搜索
- Web Push 提醒
- 习惯打卡、完成统计 / 热力图
- 多设备同步（Supabase、Cloudflare D1 都可以）
- iOS 主屏小组件（PWA 做不到，需要原生或 Scriptable）
