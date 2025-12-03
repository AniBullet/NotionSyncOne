# NotionSyncWechat

<div align="center">
  <img src="./assets/icon.png" alt="NotionSyncWechat Logo" width="120" height="120" />
  <h3>将 Notion 文章同步到微信公众号的桌面应用</h3>
  <p>简洁 · 高效 · 优雅</p>
</div>

![应用截图](./assets/app-screenshot.png)

## ✨ 功能特点

### 核心功能
- 🔄 从 Notion 数据库自动同步文章
- 📝 智能转换为微信公众号格式
- 📸 **自动上传图片** - 正文图片自动上传到微信素材库
- 🎨 美观的界面设计
- 📊 实时同步状态显示
- ⚙️ 简单的配置管理
- 🔍 文章预览功能

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
- 微信公众号 AppID 和 AppSecret

#### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/AniBullet/NotionSyncWechat.git
cd notionsyncwechat
```

2. **一键初始化环境（推荐）**
```powershell
# Windows 用户使用 PowerShell
.\setup.ps1
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
.\start.cmd

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

### 3. 应用内配置

1. 启动应用后点击左侧 "配置"
2. 填入 Notion API Key 和 Database ID
3. 填入微信公众号 AppID 和 AppSecret
4. （可选）设置文章顶部提示语
5. （可选）设置默认作者
6. 点击保存

## 🎯 使用流程

1. **在 Notion 中编写文章**
   - 支持文字、图片、代码块、链接等
   - 图片会自动上传到微信素材库

2. **同步文章**
   - 点击 "刷新列表" 获取最新文章
   - 选择文章点击 "同步到微信"
   - 查看同步进度和结果

3. **查看草稿**
   - 登录微信公众号后台
   - 进入 "草稿箱" 查看已同步的文章
   - 可以进一步编辑或直接发布

## 📦 打包分发

### 快速打包

```bash
# Windows（推荐）
_build.cmd          # 生产构建（推荐发布用）
_build_DEBUG.cmd    # 调试构建（含完整日志，仅调试用）

# 开发与检查
_dev.cmd            # 开发服务器（热重载）
_check_security.cmd # 依赖安全检查

# 或手动
pnpm build          # 生产构建
pnpm run build:dev  # 开发构建
pnpm audit          # 安全检查
```

### 打包产物

```
dist\
  ├── NotionSyncWechat-1.0.0.exe         # 安装程序
  └── NotionSyncWechat-1.0.0-portable.exe # 便携版（推荐）
```

**推荐分享便携版**：体积更小，无需安装，双击即用。

### 日志级别说明

| 构建方式 | 日志级别 | 用途 |
|---------|---------|------|
| `_build.cmd` | 最小 | ✅ 发布用 |
| `_build_DEBUG.cmd` | 完整 | 🔍 调试用 |
| `_dev.cmd` | 完整 | 💻 开发用 |

## 🛠️ 开发指南

### 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── services/      # 核心服务
│   │   ├── NotionService.ts    # Notion API
│   │   ├── WeChatService.ts    # 微信 API
│   │   ├── SyncService.ts      # 同步逻辑
│   │   └── ConfigService.ts    # 配置管理
│   └── ipc/           # 进程间通信
├── renderer/          # 前端界面
│   ├── components/    # UI 组件
│   └── styles/        # 样式文件
└── shared/            # 共享类型和工具
    └── types/         # TypeScript 类型定义
```

### 关键技术

- **Electron** - 桌面应用框架
- **Vue 3** + **React** - 前端框架（混合使用）
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Notion API** - 获取文章内容
- **微信公众平台 API** - 上传图片和发布文章

### 开发命令

```bash
pnpm dev              # 开发模式（热重载）
pnpm build            # 构建应用
pnpm preview          # 预览构建结果
```

## ⚠️ 常见问题

### Q: 图片上传失败？
**A:** 检查图片来源是否有防盗链，应用会自动使用 Notion 代理绕过。

### Q: 同步失败？
**A:** 
1. 检查 Notion API Key 和 Database ID 是否正确
2. 确保已将 integration 添加到数据库权限
3. 检查微信公众号配置和 IP 白名单

### Q: 代码块或链接样式不对？
**A:** 确保重启了应用，修改后的样式需要重新编译。

### Q: 启动后界面空白？
**A:** 
1. 检查是否有防火墙拦截
2. 删除 `out/` 目录后重新运行 `pnpm dev`

更多问题请查看 [快速开始指南](./docs/QUICK_START.md)

## 🤝 参考项目

本项目参考并优化了以下开源项目：

- **[Wheeeeeeeeels/zaka-notion2pubflow](https://github.com/Wheeeeeeeeels/zaka-notion2pubflow)** - 基础架构和 Notion 同步逻辑
- **[nmvr2600/notion2wechat](https://github.com/nmvr2600/notion2wechat)** - 图片处理和排版优化思路

感谢原作者的贡献！🙏

## 🤝 贡献指南

欢迎贡献代码！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👤 作者

[**Bullet.S（Bilibili 主页）**](https://space.bilibili.com/2031113)

## 🙏 致谢

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [Notion API](https://developers.notion.com/) - Notion 官方 API
- [微信公众平台](https://mp.weixin.qq.com/) - 微信公众号 API
- [Wheeeeeeeeels/zaka-notion2pubflow](https://github.com/Wheeeeeeeeels/zaka-notion2pubflow) - 项目灵感来源
- [nmvr2600/notion2wechat](https://github.com/nmvr2600/notion2wechat) - 排版优化参考

## 📚 文档

- [快速开始指南](./docs/QUICK_START.md)
- [部署指南](./DEPLOY.md)
- [更新日志](./docs/CHANGELOG.md)

---

**如果这个项目对你有帮助，请给个 ⭐️ Star！**
