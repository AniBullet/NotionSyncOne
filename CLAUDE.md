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

- 用户希望这个项目从“个人硬编码模板”变成别人也能配置使用的同步工具。
- 同步渠道需要可开关；关闭的渠道不应出现在主页同步入口、全部同步、状态圆点、计数和失败列表里。
- 全局平台展示顺序固定为：微信、B站、WP。包括主页、设置页、状态、计数、失败列表和 readiness。
- WP 默认关闭，用户显式开启后才检查站点 URL、用户名、应用密码。
- B站默认也按可选渠道处理；关闭时不参与主页和全部同步。
- UI 不要可见 emoji；文案短、直接，避免技术堆砌。
- 设置页不再用“高级选项”折叠；已有设置直接展示。
- 设置页左侧页签栏要窄一些，宽度贴合文字。
- 简介模板放在 B站设置最后；避免一个页面滚动条里再出现 textarea 内层滚动条造成混乱。
- 每个设置区的“测试连接”放在顶部“已配置/状态”同行右侧。

## Domain Decisions

- `defaultTid` 是 B站公共投稿分区 ID。
- `defaultSeasonId` 保存 B站合集分组 `section_id`，不是投稿分区。
- B站上传成功后，如果配置了固定合集分组，再尝试把稿件加入该合集分组。
- 加入合集失败要明确报错，不能把整体显示成完全成功。
- B站简介模板支持变量时，UI 必须告诉用户可用变量，不能只写“支持 8 个变量”。
- `biliup-rs` 旧提示已改为指向 `biliup/biliup`；不要再引导用户去旧仓库。
- B站昵称接口如果公开空间 API 返回 400，但 Cookie 中能读到 UID，可以按已登录继续；日志不要把可恢复状态吓成硬失败。
- Notion 字段不应假设所有人都用固定模板。
- Notion 字段映射要用 UI 单项填写，不要让用户填一整块 JSON/文本，容易填错。
- Notion 默认字段名保留兼容，但用户可改映射。
- 用户侧名称倾向：`来源` 改为 `来源平台`，`作者` 改为 `原作者`，`评分` 改为 `个人期待值`。
- `Engine` 等字段应可选；别人未必有同名属性。
- Notion API 读列表已有重试；读单页属性和页面内容也需要覆盖 `ECONNRESET` 等瞬时网络错误。

## Current Implementation Notes

- 已有测试覆盖 WP 默认关闭、同步渠道开关、平台顺序、隐藏关闭渠道、设置页布局、Notion 字段映射 UI、B站变量提示、B站合集分组、B站昵称诊断、Notion 页面读取重试。
- 当前测试总数曾验证到 84 个通过；继续改动后仍需重新跑检查，不沿用旧结果。
- `src/main/services/sync/notionFields.ts` 是 Notion 字段映射辅助逻辑。
- `src/main/services/NotionService.ts` 负责 Notion 列表、单页属性、页面内容读取；网络重试逻辑在这里维护。
- `src/main/services/BilibiliService.ts` 负责 B站 API 和诊断日志；不要把可恢复的昵称查询失败升级成登录失败。
- `src/main/services/sync/bilibiliSync.ts` 负责上传后的同步流程，包括加入固定合集。
- `src/renderer/components/SettingsModal.tsx` 是设置页主要 UI。
- `src/renderer/components/MainLayout.tsx`、`ArticleGrid.tsx` 和 `src/renderer/utils/*Status*` 影响主页渠道显示、状态、计数、失败呈现。

## Current Product Plan

第一阶段和 Notion 字段映射通用化已有初步实现，但仍按下面标准维护和补齐。

1. B站设置新增固定合集分组 ID。
   - 字段含义：`defaultTid` 是公共投稿分区 ID；`defaultSeasonId` 保存 B站合集分组 `section_id`。
   - 上传完成拿到稿件信息后，再尝试加入固定合集分组。
   - 加合集失败要报清楚，不能伪装成上传完全成功。
2. WP 默认关闭，可选开启。
   - 设置页增加 WP 同步开关，默认 `false`。
   - 关闭时不参与主页同步入口、全部同步、状态 readiness。
   - 开启后再检查站点 URL、用户名、应用密码。
3. 全局平台顺序统一为：微信、B站、WP。
   - 包括主页按钮、计数、状态圆点、失败列表、readiness、设置页页签。
4. 设置页 UI 清理。
   - 页签栏收窄，宽度贴合文字。
   - 去掉可见 emoji。
   - B站设置不再折叠高级选项。
   - 简介模板放到 B站设置最后；避免 textarea 内层滚动条。
5. 工具链提示更新。
   - `biliup-rs` 旧提示切到 `biliup/biliup`。
   - 保持 `yt-dlp`、`ffmpeg` 检测和安装提示一致。
6. 第二阶段：Notion 字段映射通用化。
   - 不再默认所有用户都使用 `AddedTime`、`LinkStart`、`From`、`Author`、`FeatureTag`、`ExpectationsRate`、`Engine` 这套模板。
   - 优先设计字段映射配置，再改同步逻辑。
   - 字段映射应使用独立输入控件，不使用大文本框。

## Follow-up Issues

1. 失败/报错面板交互优化。
   - 每条失败记录需要支持“删除”或“标为已读”，否则会一直在左下角显示。
   - 初始状态不要展开详情，只显示标题。
   - 用户点击后再展开显示完整报错详情。
2. B站加入合集失败需要开发版实测。
   - 已观察到案例：`在你的动画中使用PHYSICS！ | UE5.7` 视频上传成功，但加入 B站合集失败：`Request failed with status code 400`。
   - 需要在开发版实际跑一次，查看终端详细报错和 B站接口响应体。
   - 判断重点：是 `section_id` 配错、稿件 `aid/bvid` 时机不对、接口参数缺失，还是 Cookie/权限/风控导致。
   - 不能只根据 UI 的 400 文案下结论。

## Agent Entry Points

- `AGENTS.md` 是唯一维护的正文。
- `CLAUDE.md` 应与 `AGENTS.md` 内容一致；本机可用 NTFS hardlink 指向同一内容。
- 修改规则后运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-agent-rules.ps1
```
