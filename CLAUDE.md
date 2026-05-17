# Agent Instructions

## Core Rules

- 始终中文回复，短句优先，少 filler。
- 先读项目现状，再动手；不确定就标注「我的判断是...」或先验证。
- 只碰当前任务必须触及的文件，不做顺手重构。
- 成功标准要可验证；实现后跑对应检查，不把未验证说成已完成。
- Debug 先造反馈循环：失败用例、CLI、日志、最小复现，再判断根因。
- 不隐藏真实失败。`quiet`、`silent`、fallback 只能压低非关键噪音，不能让失败看起来像成功。

## Repo Context

- 这是 Electron + React + TypeScript 项目。
- 主进程服务在 `src/main/services/`；渲染层主要在 `src/renderer/components/` 和 `src/renderer/utils/`。
- 同步入口涉及 Notion 取数、微信图文、B站视频、WordPress 文章。
- Notion 是源数据；微信、B站、WP 是同步渠道。
- 常用检查：
  - `npm run check:type`
  - `npm run check:lint`
  - `npm run check:test`
  - `npm run check`
- 外部视频/B站能力依赖 `biliup`、`yt-dlp`、`ffmpeg`，相关提示和下载地址要保持一致。

## Product Background

- 用户希望这个项目从"个人硬编码模板"变成别人也能配置使用的同步工具。
- 同步渠道需要可开关；关闭的渠道不应出现在主页同步入口、全部同步、状态圆点、计数和失败列表里。
- 全局平台展示顺序固定为：微信、B站、WP。包括主页、设置页、状态、计数、失败列表和 readiness。
- WP 默认关闭，用户显式开启后才检查站点 URL、用户名、应用密码。
- B站默认也按可选渠道处理；关闭时不参与主页和全部同步。
- UI 不要可见 emoji；文案短、直接，避免技术堆砌。
- 设置页不再用"高级选项"折叠；已有设置直接展示。
- 设置页左侧页签栏要窄一些，宽度贴合文字。
- 简介模板放在 B站设置最后；避免一个页面滚动条里再出现 textarea 内层滚动条造成混乱。
- 每个设置区的"测试连接"放在顶部"已配置/状态"同行右侧。

## Domain Decisions

- `defaultTid` 是 B站公共投稿分区 ID。
- `defaultSeasonId` 保存 B站合集分组 `section_id`，不是投稿分区。
- B站上传成功后，如果配置了固定合集分组，再尝试把稿件加入该合集分组。
- 加入合集失败要明确报错，不能把整体显示成完全成功。
- B站简介模板支持变量时，UI 必须告诉用户可用变量，不能只写"支持 8 个变量"。
- `biliup-rs` 旧提示已改为指向 `biliup/biliup`；不要再引导用户去旧仓库。
- B站昵称接口如果公开空间 API 返回 400，但 Cookie 中能读到 UID，可以按已登录继续；日志不要把可恢复状态吓成硬失败。
- B站草稿视频查询用 `member.bilibili.com/x/client/archive/view?access_key={token}&bvid={bvid}`，不能用公开 API（草稿返回 -404）。
- `access_key` 从 biliup cookie 文件的 `token_info.access_token` 读取。
- B站合集列表接口：`member.bilibili.com/x2/creative/web/seasons`，参数 `{ pn:1, ps:50, order:'mtime', sort:'desc', draft:1 }`，响应结构 `data.seasons[].season.{id,title}` 和 `data.seasons[].sections.sections[].{id,title}`。
- Notion 字段不应假设所有人都用固定模板。
- Notion 字段映射要用 UI 单项填写，不要让用户填一整块 JSON/文本，容易填错。
- Notion 默认字段名保留兼容，但用户可改映射。
- 用户侧名称倾向：`来源` 改为 `来源平台`，`作者` 改为 `原作者`，`评分` 改为 `个人期待值`。
- `Engine` 等字段应可选；别人未必有同名属性。
- Notion API 读列表已有重试；读单页属性和页面内容也需要覆盖 `ECONNRESET` 等瞬时网络错误。

## Current Implementation Notes

已实现并经测试验证（84 个测试通过）的功能：

**渠道开关与顺序**
- WP 默认关闭，显式开启后才检查配置；B站同理。
- 全局平台顺序：微信 → B站 → WP，所有入口一致。
- 关闭的渠道不出现在主页同步按钮、全部同步、状态圆点、计数、失败列表。

**B站**
- 设置页可搜索分区下拉（内置 100+ 分区，替代数字输入框）。
- 设置页可获取账号合集列表并选择，重新打开后显示已选中文名。
- 上传完成后自动尝试加入固定合集分组；失败单独报错，不伪装成整体成功。
- 草稿视频查询改用 client API（`x/client/archive/view` + `access_token`）。
- 简介模板变量在 UI 中明确列出。
- `biliup-rs` 旧提示已切换到 `biliup/biliup`。
- 昵称查询失败不升级为登录失败（UID 可从 Cookie 读到即视为已登录）。

**失败面板**
- 默认折叠，点击展开详情。
- 单条忽略（本地隐藏，重启后恢复）。
- 「标记已解决」持久清除后端 `sync-states.json` 中对应条目，重启不再显示。

**Notion 字段映射**
- `src/main/services/sync/notionFields.ts` 封装字段映射辅助逻辑。
- 设置页用独立输入控件逐项配置，不用大文本框。
- 默认字段名保留兼容，用户可覆盖。

**Notion 网络重试**
- `src/main/services/NotionService.ts` 覆盖列表、单页属性、页面内容的 `ECONNRESET` 等瞬时错误，自动重试。

**关键文件**
- `src/main/services/sync/notionFields.ts` — Notion 字段映射辅助
- `src/main/services/NotionService.ts` — Notion 读取 + 重试
- `src/main/services/BilibiliService.ts` — B站 API、诊断日志、合集列表、草稿查询
- `src/main/services/sync/bilibiliSync.ts` — B站上传流程、加入合集
- `src/main/ipc/handlers.ts` — IPC 注册：`bilibili-get-seasons`、`clear-platform-sync-state`
- `src/main/services/SyncService.ts` — `clearPlatformState` 持久清除同步状态
- `src/renderer/components/SettingsModal.tsx` — 设置页主要 UI
- `src/renderer/components/MainLayout.tsx`、`ArticleGrid.tsx`、`src/renderer/utils/*Status*` — 主页渠道显示、状态、计数、失败面板

## Follow-up Issues

1. **B站加入合集 400 错误根因待实测**
   - 已知现象：视频上传成功，加入 B站合集时返回 `Request failed with status code 400`。
   - 草稿查询已改用 client API，但 400 的具体原因尚未在开发版实测确认。
   - 需要实测确认：`section_id` 是否正确、`aid/bvid` 时机、接口参数、Cookie/权限/风控。
   - 不能只根据 UI 的 400 文案下结论；要查终端详细报错和 B站接口响应体。

2. **失败面板：单条「忽略」重启后恢复**
   - 当前「忽略」只是本地 state，重启后失败记录仍出现。
   - 「标记已解决」会清除后端状态，是持久操作。
   - 如果用户只想临时隐藏（不清除状态），需要考虑是否持久化 dismissed 列表到本地存储。

## Agent Entry Points

- `AGENTS.md` 是唯一维护的正文。
- `CLAUDE.md` 应与 `AGENTS.md` 内容一致；本机可用 NTFS hardlink 指向同一内容。
- 修改规则后运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-agent-rules.ps1
```
