# 📦 NotionSyncWechat 部署指南

## 🚀 方式一：源码部署（开发/调试）

### 前置要求
- ✅ Node.js v18 或更高版本
- ✅ pnpm 包管理器

### 步骤

#### 1. 安装 Node.js
从 [nodejs.org](https://nodejs.org/) 下载安装最新 LTS 版本

支持的安装位置（脚本会自动检测）：
- `C:\Program Files\nodejs`
- `D:\Program Files\nodejs`
- 系统 PATH 中的任何位置

#### 2. 安装 pnpm
```bash
npm install -g pnpm
```

#### 3. 复制项目文件
复制整个 `NotionSyncWechat` 文件夹到目标电脑

可以删除以下文件夹减小体积：
- `node_modules/` （会重新安装）
- `out/` （会重新构建）
- `dist/` （会重新构建）

#### 4. 安装依赖
双击 `start.cmd` 或在项目目录运行：
```bash
pnpm install
```

#### 5. 启动应用
双击 `start.cmd` 或运行：
```bash
.\start.cmd
```

#### 6. 配置
在应用界面中输入：
- Notion API Key
- Notion Database ID
- 微信公众号 AppID
- 微信公众号 AppSecret

---

## 📱 方式二：安装包部署（最终用户）

### 打包安装程序

在源码电脑上运行：
```bash
.\build.cmd
```

或手动运行：
```bash
pnpm build
```

### 安装程序位置
打包完成后，安装程序位于：
```
dist\Notion to WeChat Sync Setup X.X.X.exe
```

### 分发
将 `.exe` 文件复制到目标电脑，双击安装即可。

**优点：**
- ✅ 无需安装 Node.js
- ✅ 无需安装依赖
- ✅ 开箱即用
- ✅ 适合最终用户

---

## 🔧 配置文件迁移（可选）

### 配置文件位置

**Windows:**
```
C:\Users\你的用户名\AppData\Roaming\notion2wechat\config\
```

### 包含的配置文件
- `notion-config.json` - Notion API 配置
- `wechat-config.json` - 微信公众号配置
- `sync-states.json` - 同步状态记录

### 迁移步骤

#### 1. 导出配置（旧电脑）
复制上述配置文件到 U 盘或云盘

#### 2. 导入配置（新电脑）
1. 在新电脑上启动应用一次（创建配置目录）
2. 关闭应用
3. 将配置文件复制到对应目录
4. 重新启动应用

---

## 🐛 常见问题

### Q: 提示"无法找到 Node.js"？
**A:** 确保已安装 Node.js 并重启终端/电脑

### Q: 提示"无法找到 pnpm"？
**A:** 运行 `npm install -g pnpm` 安装 pnpm

### Q: 打包失败？
**A:** 
1. 删除 `node_modules` 重新安装：`pnpm install`
2. 清理构建文件：删除 `out/` 和 `dist/`
3. 重新运行 `.\build.cmd`

### Q: 端口 5173 被占用？
**A:** `start.cmd` 会自动停止占用端口的进程，如果还有问题：
```bash
# 手动查找并停止
netstat -ano | findstr :5173
taskkill /F /PID <进程ID>
```

### Q: 启动后界面空白？
**A:** 
1. 检查是否有防火墙拦截
2. 确保 `out/` 目录存在且有文件
3. 重新构建：`pnpm dev`

---

## 📞 技术支持

遇到问题？
1. 查看 [README.md](README.md) 了解基本使用
2. 查看 [QUICK_START.md](docs/QUICK_START.md) 了解快速开始
3. 检查终端日志中的错误信息

---

## 📝 版本信息

- **Node.js**: v18.0.0+
- **pnpm**: 最新版本
- **Electron**: 见 package.json
- **支持系统**: Windows 10/11

---

*最后更新: 2025-12-01*

