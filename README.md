# NotionSyncOne

<div align="center">
  <img src="./assets/icon.png" alt="NotionSyncOne Logo" width="120" height="120" />
  <h3>将 Notion 文章一键同步到多平台</h3>
  <p>微信公众号 · WordPress · Bilibili</p>
  
  ![GitHub Stars](https://img.shields.io/github/stars/AniBullet/NotionSyncOne?style=social)
  ![License](https://img.shields.io/badge/license-MIT-blue.svg)
  ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
</div>

![应用截图](./assets/app-screenshot.png)

## ✨ 功能亮点

- 🔄 **一键同步** - Notion 文章智能转换为多平台格式
- 📸 **图片自动上传** - 无需手动处理，图片自动上传到目标平台
- 🎬 **B站视频投稿** - 自动提取视频并投稿到B站（支持草稿/发布）
- 💎 **精美排版** - 代码高亮、链接优化、自适应布局
- 📊 **实时状态** - 同步进度和状态一目了然
- ⚙️ **简单配置** - 一次配置，持久保存

### 🎯 支持平台

| 平台 | 功能 | 状态 |
|------|------|------|
| **微信公众号** | 图文同步、草稿/发布 | ✅ |
| **WordPress** | 文章发布、分类标签 | ✅ |
| **Bilibili** | 视频投稿、自动压缩 | ✅ |

## 🚀 快速开始

### 📥 下载安装（推荐）

1. 前往 [Releases](https://github.com/AniBullet/NotionSyncOne/releases) 下载最新版
2. 运行安装程序或便携版
3. 配置 Notion API 和平台信息
4. 开始同步！

### 💻 源码运行

```bash
# 1. 克隆项目
git clone https://github.com/AniBullet/NotionSyncOne.git
cd NotionSyncOne

# 2. 一键初始化（Windows）
.\ns-setup.ps1

# 3. 启动应用
.\ns-dev.cmd
# 或
pnpm dev
```

<details>
<summary>📋 前置要求</summary>

**必须：**
- Node.js 18+
- Notion API Key

**可选（按需）：**
- 微信公众号 AppID/AppSecret
- WordPress 应用密码
- biliup-rs + FFmpeg（B站投稿）

</details>

## ⚙️ 配置指南

<details>
<summary><b>1️⃣ Notion 配置（必须）</b></summary>

#### 创建 Integration

1. 访问 [Notion Integrations](https://www.notion.so/my-integrations) 创建 Integration
2. 复制 API Key
3. 打开数据库，从 URL 中获取 Database ID：
   
   **URL 格式：** `https://www.notion.so/xxx/[DatabaseID]?v=zzz`
   
   例如：`https://www.notion.so/workspace/abc123def456?v=789`  
   其中 `abc123def456` 就是 Database ID

4. **重要**：在数据库页面点击右上角「···」→「添加连接」→ 选择你创建的 Integration

#### 数据库字段要求

你的 Notion 数据库**至少**需要包含以下字段：

| 字段名 | 类型 | 必须 | 说明 |
|--------|------|------|------|
| **Title** | 标题 | ✅ | 文章标题（Notion 数据库默认字段） |
| **AddedTime** | 日期 | ✅ | 文章添加时间，用于排序 |

**可选字段**（增强功能）：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| **LinkStart** | URL 或文本 | 文章原文链接 |
| **From** | 文本 | 文章来源 |
| **Author** | 文本 | 作者名称 |
| **FeatureTag** | 单选或多选 | 特色标签 |
| **ExpectationsRate** | 数字 | 期望评分 |
| **Engine** | 单选 | 引擎/分类 |

**数据库示例结构**：

```
📊 我的文章库
├─ Title (标题) - 文章标题
├─ AddedTime (日期) - 2026-01-13
├─ LinkStart (URL) - https://example.com
├─ From (文本) - 微信公众号
├─ Author (文本) - 张三
├─ FeatureTag (多选) - 技术, 教程
├─ ExpectationsRate (数字) - 5
└─ Engine (单选) - WordPress
```

#### 配置应用

在应用「配置」页面填入：
- **Notion API Key**：你创建的 Integration 密钥
- **Notion Database ID**：数据库 ID

</details>

<details>
<summary><b>2️⃣ 微信公众号配置（可选）</b></summary>

#### 获取 AppID 和 AppSecret

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「设置与开发」→「基本配置」
3. 复制 **AppID** 和 **AppSecret**（需要管理员扫码确认）

#### IP 白名单设置

**重要**：如果同步时提示 IP 未加白名单，需要：

1. 在「基本配置」页面找到「IP白名单」
2. 点击「修改」添加你的服务器 IP
3. 如何获取 IP：
   - 访问 [https://ipinfo.io/ip](https://ipinfo.io/ip) 查看当前 IP
   - 或运行命令：`curl ipinfo.io/ip`（Linux/Mac）

#### 主题样式配置（可选）

应用支持多种排版主题，在微信配置中添加 `theme` 字段：

```json
{
  "appId": "你的AppID",
  "appSecret": "你的AppSecret",
  "theme": "wechat"
}
```

**可选主题**：
- `default` - 默认蓝色主题
- `wechat` - 微信绿色主题（推荐）
- `hongfei` - 红色主题
- `jianhei` - 黑色极简主题
- `shanchui` - 橙黄色温暖主题
- `chengxin` - 橙色活力主题

</details>

<details>
<summary><b>3️⃣ WordPress 配置（可选）</b></summary>

#### 前置要求

- WordPress 版本 >= 5.6
- 已启用 REST API（默认启用）

#### 生成应用密码

1. 登录 WordPress 后台
2. 进入「用户」→「个人资料」
3. 滚动到底部「应用密码」部分
4. 输入名称（如：NotionSyncOne），点击「添加新应用密码」
5. 复制生成的密码（格式：`xxxx xxxx xxxx xxxx`）

**注意**：应用密码不同于登录密码，可以随时撤销，更安全。

#### 配置应用

在应用中填入：
- **站点 URL**：你的 WordPress 网站地址（如：`https://example.com`）
- **用户名**：WordPress 管理员用户名
- **应用密码**：刚刚生成的应用密码（保留空格或删除空格都可以）

#### 高级配置（可选）

可配置文章的默认分类和标签：

```json
{
  "siteUrl": "https://example.com",
  "username": "admin",
  "appPassword": "xxxx xxxx xxxx xxxx",
  "defaultCategory": "技术",
  "defaultTags": ["Notion", "自动化"]
}
```

</details>

<details>
<summary><b>4️⃣ Bilibili 配置（可选）</b></summary>

#### 安装依赖工具

**Windows 用户**（推荐使用 winget）：

```bash
# 安装 biliup-rs（B站上传工具）
winget install biliup

# 安装 FFmpeg（视频处理工具）
winget install BtbN.FFmpeg.GPL
```

**手动安装**：

- biliup-rs：[https://github.com/biliup/biliup-rs](https://github.com/biliup/biliup-rs/releases)
- FFmpeg：[https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)

安装后确保命令可用：

```bash
biliup --version
ffmpeg -version
```

#### 登录 B站账号

首次使用需要登录：

```bash
# 方法1：扫码登录（推荐）
biliup login

# 方法2：使用 Cookie
# 在浏览器登录B站，复制 Cookie 到配置文件
```

#### 功能说明

- ✅ 自动提取 Notion 页面中的视频
- ✅ 视频自动压缩（如果超过B站限制）
- ✅ 支持草稿和直接发布两种模式
- ✅ 自动设置标题、标签、分类

**注意**：
- 视频必须是 Notion 中上传的视频块，不支持外链视频
- B站对视频有大小和时长限制（根据账号等级不同）
- 视频过大时会自动使用 FFmpeg 压缩

</details>

## 🎯 使用流程

```
Notion 编写 → 点击同步 → 选择平台 → 完成发布
```

1. **准备文章** - 在 Notion 中编写（支持文字、图片、代码、视频）
2. **刷新列表** - 应用中点击"刷新"获取最新文章
3. **选择平台** - 点击对应平台的同步按钮
4. **查看结果** - 在对应平台后台查看发布结果

## 📦 开发打包

```bash
# 快速命令（Windows）
.\ns-dev.cmd            # 开发模式
.\ns-build.cmd          # 生产构建

# 或使用 pnpm 命令
pnpm dev                # 开发模式
pnpm build              # 生产构建

# 其他命令
pnpm check:audit        # 依赖安全检查
pnpm check:lint         # 代码规范检查
```

**打包说明**：
- 打包产物在 `dist/` 目录
- 推荐分享 `portable` 版本（体积小，无需安装）
- `ns-` 前缀的脚本在根目录，方便快速访问

<details>
<summary>🛠️ 技术栈</summary>

- **Electron** - 桌面应用框架
- **React** + **TypeScript** - 前端开发
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Notion API** / **微信 API** / **WordPress REST API**

</details>

## ❓ 常见问题

<details>
<summary><b>❌ 提示「找不到指定的数据库」？</b></summary>

**原因**：Integration 没有访问数据库的权限

**解决**：
1. 打开你的 Notion 数据库页面
2. 点击右上角「···」→「添加连接」
3. 选择你创建的 Integration
4. 重新刷新应用中的文章列表

</details>

<details>
<summary><b>❌ Notion 同步失败，提示网络错误？</b></summary>

**可能原因**：
1. 网络不稳定或被限制
2. Database ID 或 API Key 不正确

**解决**：
1. 检查网络连接，尝试使用代理
2. 确认 API Key 和 Database ID 无误
3. 应用会自动重试 3 次，请耐心等待

</details>

<details>
<summary><b>❌ 微信图片上传失败？</b></summary>

**可能原因**：
1. 服务器 IP 未加入白名单
2. 图片 URL 无法访问（Notion 图片有防盗链）

**解决**：
1. 在微信公众平台添加你的服务器 IP 到白名单
2. 应用会自动使用代理绕过防盗链
3. 确保图片大小 < 5MB

</details>

<details>
<summary><b>❌ WordPress 发布失败？</b></summary>

**可能原因**：
1. 应用密码不正确
2. WordPress 版本过低
3. REST API 被禁用

**解决**：
1. 重新生成应用密码并配置
2. 升级 WordPress 到 5.6 或更高版本
3. 检查是否有插件禁用了 REST API

</details>

<details>
<summary><b>❌ B站投稿失败？</b></summary>

**可能原因**：
1. `biliup-rs` 或 `FFmpeg` 未安装
2. Cookie 过期需要重新登录
3. 视频格式不支持或超过大小限制

**解决**：
1. 确认已安装：`biliup --version` 和 `ffmpeg -version`
2. 重新登录：`biliup login`
3. 使用 MP4 格式，确保视频大小符合B站要求

</details>

<details>
<summary><b>❓ 数据库字段名可以自定义吗？</b></summary>

暂时不支持自定义字段名，请按照文档要求创建字段。

**必须字段**：`Title`（标题）、`AddedTime`（日期）

**可选字段**：`LinkStart`、`From`、`Author`、`FeatureTag`、`ExpectationsRate`、`Engine`

</details>

<details>
<summary><b>❓ 配置文件存储在哪里？</b></summary>

**Windows**：`C:\Users\你的用户名\AppData\Roaming\notionsyncone\config\`

**包含文件**：
- `config.json` - 配置信息（敏感字段已加密）
- `sync-states.json` - 同步状态记录

**安全说明**：API Key、密码等敏感信息使用系统级加密存储，其他人无法读取。

</details>

<details>
<summary><b>❓ 如何更新到最新版本？</b></summary>

应用会自动检查更新：
1. 启动时自动检查 GitHub 最新版本
2. 有新版本时标题栏显示绿色提示
3. 点击提示进入「关于」页面下载

**手动检查**：前往 [Releases](https://github.com/AniBullet/NotionSyncOne/releases) 下载最新版

</details>

## 📚 文档

- 📖 [快速开始指南](./docs/QUICK_START.md) - 5分钟上手教程
- 🚀 [部署指南](./docs/DEPLOY.md) - 安装和打包说明
- 🤝 [贡献指南](./docs/CONTRIBUTING.md) - 参与项目开发
- 🔒 [安全说明](./docs/SECURITY.md) - 数据安全和隐私
- 📋 [更新日志](./docs/CHANGELOG.md) - 版本历史

## 🙏 致谢

本项目参考了以下优秀开源项目：

- [Wheeeeeeeeels/zaka-notion2pubflow](https://github.com/Wheeeeeeeeels/zaka-notion2pubflow) - 项目灵感来源
- [nmvr2600/notion2wechat](https://github.com/nmvr2600/notion2wechat) - 排版优化参考
- [biliup/biliup](https://github.com/biliup/biliup) - B站上传工具

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证

## 👤 作者

[Bullet.S](https://space.bilibili.com/2031113) - Bilibili 主页

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star！**

[报告问题](https://github.com/AniBullet/NotionSyncOne/issues) · [功能建议](https://github.com/AniBullet/NotionSyncOne/issues) · [提交PR](https://github.com/AniBullet/NotionSyncOne/pulls)

</div>
