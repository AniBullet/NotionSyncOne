# NotionSyncOne

<div align="center">
  <img src="./assets/icon.png" alt="NotionSyncOne Logo" width="120" height="120" />
  <h3>将 Notion 文章同步到多个平台的桌面应用</h3>
  <p>支持 微信公众号 · WordPress · 简洁高效</p>
</div>

![应用截图](./assets/app-screenshot.png)

## ✨ 功能特点

### 核心功能
- 🔄 从 Notion 数据库自动同步文章
- 📝 智能转换为多平台格式（微信公众号、WordPress）
- 📸 **自动上传图片** - 图片自动上传到目标平台
- 🎨 美观的界面设计
- 📊 实时同步状态显示
- ⚙️ 简单的配置管理
- 🔍 文章预览功能

### 📦 多平台支持
- **微信公众号** - 完整支持草稿和发布功能
- **WordPress** - 支持 REST API，可自定义分类和标签

### 💎 排版优化
- 💻 **代码块美化** - 带行号的专业代码块样式
- 🔗 **链接优化** - 清晰的链接展示（文字 + URL）
- 🎨 **精美排版** - 标题分级、列表优化、引用美化
- 📐 **自适应布局** - 简洁清爽，主次分明
- 🔄 **热重载支持** - 修改代码自动编译，提升开发效率

## 🚀 快速开始

### 方式一：使用安装程序（推荐）

1. 下载最新版本的安装程序
2. 双击运行安装
3. 启动应用并配置

### 方式二：源码运行

#### 前置要求
- Node.js 18+
- pnpm（推荐）或 npm
- Notion API Key
- 微信公众号 AppID 和 AppSecret（可选）
- WordPress 站点和应用密码（可选）

#### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/AniBullet/NotionSyncOne.git
cd NotionSyncOne
```

2. **一键初始化环境（推荐）**
```powershell
# Windows 用户使用 PowerShell
.\scripts\setup.ps1
```

该脚本会自动：
- ✅ 检查 Node.js 环境
- ✅ 安装 pnpm（如未安装）
- ✅ 清理旧依赖
- ✅ 安装所有项目依赖
- ✅ 配置 Electron 环境

**或手动安装依赖：**
```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install
```

3. **启动应用**
```bash
# Windows 用户（推荐）
.\scripts\dev.cmd

# 或手动启动
pnpm dev
```

## 📝 配置说明

### 1. Notion 配置

**获取 Notion API Key：**
1. 访问 [Notion Integrations](https://www.notion.so/my-integrations)
2. 点击 "New integration"
3. 填写名称并创建
4. 复制生成的 API Key

**获取数据库 ID：**
1. 在浏览器中打开您的 Notion 数据库
2. URL 中形如 `https://www.notion.so/xxx/yyy?v=zzz` 的 `yyy` 部分就是数据库 ID

**数据库属性要求：**
   - `title`（标题）: 文章标题
- `LinkStart`（URL）: 原文链接
   - `From`（文本）: 来源
   - `Author`（文本）: 作者
- `FeatureTag`（多选）: 标签
- `ExpectationsRate`（数字）: 个人期望值
- `Engine`（选择）: 使用引擎
   - `AddedTime`（日期）: 添加时间

### 2. 微信公众号配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 "设置与开发 > 基本配置"
3. 获取 AppID 和 AppSecret
4. **重要**：添加服务器 IP 地址到白名单

### 3. WordPress 配置（可选）

1. 确保您的 WordPress 版本 >= 5.6
2. 在 WordPress 后台 → 用户 → 个人资料 → 应用密码
3. 生成一个新的应用密码
4. 在 NotionSyncOne 中配置站点 URL、用户名和应用密码

### 4. 应用内配置

1. 启动应用后点击左侧 "配置"
2. 填入 Notion API Key 和 Database ID
3. 填入微信公众号 AppID 和 AppSecret（可选）
4. 填入 WordPress 配置（可选）
5. 点击保存

## 🎯 使用流程

1. **在 Notion 中编写文章**
   - 支持文字、图片、代码块、链接等
   - 图片会自动上传到目标平台

2. **同步文章**
   - 点击 "刷新列表" 获取最新文章
   - 点击文章的 "同步" 按钮
   - 选择目标平台（微信/WordPress/两者）
   - 选择发布模式（草稿/直接发布）

3. **查看结果**
   - 微信：登录公众号后台，进入 "草稿箱"
   - WordPress：在站点后台查看文章列表

## 📦 打包分发

### 快速打包

```bash
# Windows（推荐）
scripts\build.cmd          # 生产构建（推荐发布用）
scripts\build_debug.cmd    # 调试构建（含完整日志，仅调试用）

# 开发与检查
scripts\dev.cmd            # 开发服务器（热重载）
scripts\check_security.cmd # 依赖安全检查

# 或手动
pnpm build          # 生产构建
pnpm run build:dev  # 开发构建
pnpm audit          # 安全检查
```

### 打包产物

```
dist\
  ├── NotionSyncOne-1.0.0.exe         # 安装程序
  └── NotionSyncOne-1.0.0-portable.exe # 便携版（推荐）
```

**推荐分享便携版**：体积更小，无需安装，双击即用。

## 🛠️ 开发指南

### 项目结构

```
├── assets/            # 应用资源文件
├── docs/              # 文档
├── public/            # 公共资源
├── scripts/           # 构建脚本
├── src/
│   ├── main/          # Electron 主进程
│   │   ├── services/  # 核心服务
│   │   │   ├── NotionService.ts     # Notion API
│   │   │   ├── WeChatService.ts     # 微信 API
│   │   │   ├── WordPressService.ts  # WordPress API
│   │   │   ├── SyncService.ts       # 同步逻辑
│   │   │   └── ConfigService.ts     # 配置管理
│   │   └── ipc/       # 进程间通信
│   ├── renderer/      # 前端界面
│   │   ├── components/# UI 组件
│   │   └── styles/    # 样式文件
│   └── shared/        # 共享类型和工具
│       └── types/     # TypeScript 类型定义
├── package.json
└── vite.config.ts
```

### 关键技术

- **Electron** - 桌面应用框架
- **React** - 前端框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Notion API** - 获取文章内容
- **微信公众平台 API** - 上传图片和发布文章
- **WordPress REST API** - WordPress 文章管理

### 开发命令

```bash
pnpm dev              # 开发模式（热重载）
pnpm build            # 构建应用
pnpm preview          # 预览构建结果
```

## ⚠️ 常见问题

### Q: 图片上传失败？
**A:** 检查图片来源是否有防盗链，应用会自动使用代理绕过。

### Q: 同步失败？
**A:** 
1. 检查 Notion API Key 和 Database ID 是否正确
2. 确保已将 integration 添加到数据库权限
3. 检查微信公众号配置和 IP 白名单
4. 检查 WordPress 应用密码是否正确

### Q: WordPress 连接失败？
**A:**
1. 确保站点 URL 正确（包含 https://）
2. 确保 WordPress 版本 >= 5.6
3. 检查应用密码是否正确生成

更多问题请查看 [快速开始指南](./docs/QUICK_START.md)

## 📋 更新日志

### 最新版本：v1.0.1

**🐛 修复**
- 修复文章内容过长导致微信发布失败的问题（45166 错误）
- 优化图片命名：封面图显示为 `cover.png`，正文图片按顺序命名为 `content_image_1.png` 等
- 修复 Electron 安全警告（Content-Security-Policy）

**📝 改进**
- 实现智能内容截断，确保符合微信 20000 字符限制
- 优化 HTML 标签闭合逻辑
- 改进日志输出，便于问题排查

查看完整更新记录：[CHANGELOG.md](./docs/CHANGELOG.md)

## 🤝 参考项目

本项目参考并优化了以下开源项目：

- **[Wheeeeeeeeels/zaka-notion2pubflow](https://github.com/Wheeeeeeeeels/zaka-notion2pubflow)** - 基础架构和 Notion 同步逻辑
- **[nmvr2600/notion2wechat](https://github.com/nmvr2600/notion2wechat)** - 图片处理和排版优化思路

感谢原作者的贡献！🙏

## 🤝 贡献指南

欢迎贡献代码！我们欢迎各种形式的贡献：

- 🐛 **报告 Bug**：在 [Issues](https://github.com/AniBullet/NotionSyncOne/issues) 中提交问题
- ✨ **功能建议**：分享你的想法和改进建议
- 💻 **代码贡献**：提交 Pull Request
- 📝 **文档改进**：帮助完善文档

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

详细的开发规范和提交规范请查看：[贡献指南](./docs/CONTRIBUTING.md)

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👤 作者

[**Bullet.S（Bilibili 主页）**](https://space.bilibili.com/2031113)

## 🙏 致谢

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [Notion API](https://developers.notion.com/) - Notion 官方 API
- [微信公众平台](https://mp.weixin.qq.com/) - 微信公众号 API
- [WordPress REST API](https://developer.wordpress.org/rest-api/) - WordPress API
- [Wheeeeeeeeels/zaka-notion2pubflow](https://github.com/Wheeeeeeeeels/zaka-notion2pubflow) - 项目灵感来源
- [nmvr2600/notion2wechat](https://github.com/nmvr2600/notion2wechat) - 排版优化参考

## 📚 文档

- [快速开始指南](./docs/QUICK_START.md)
- [部署指南](./docs/DEPLOY.md)
- [更新日志](./docs/CHANGELOG.md)
- [贡献指南](./docs/CONTRIBUTING.md)
- [安全说明](./docs/SECURITY.md)

---

**如果这个项目对你有帮助，请给个 ⭐️ Star！**
