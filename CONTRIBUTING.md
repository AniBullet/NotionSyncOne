# 贡献指南

感谢你考虑为 NotionSyncWechat 做出贡献！

## 🚀 快速开始

### 1. Fork 并克隆仓库

```bash
git clone https://github.com/AniBullet/notionsyncwechat.git
cd notionsyncwechat
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

```bash
.\start.cmd   # Windows
# 或
pnpm dev
```

## 📝 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构代码
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关

#### 示例

```
feat(sync): 添加批量同步功能

- 支持选择多篇文章同步
- 添加同步进度条
- 优化错误提示

Close #123
```

## 🔧 开发规范

### 代码风格

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用有意义的变量和函数名
- 添加必要的注释

### 文件组织

```
src/
├── main/          # 主进程
├── renderer/      # 渲染进程
└── shared/        # 共享代码
```

### 命名规范

- 文件名：PascalCase（如 `NotionService.ts`）
- 组件名：PascalCase（如 `ArticleList.tsx`）
- 函数名：camelCase（如 `syncArticle`）
- 常量名：UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）

## 🧪 测试

```bash
pnpm test
```

## 📦 构建

```bash
.\build.cmd   # Windows
# 或
pnpm build
```

## 🐛 报告 Bug

在提交 Issue 时，请包含：

1. **问题描述**：清晰描述问题
2. **复现步骤**：如何重现问题
3. **预期行为**：期望的正确行为
4. **实际行为**：当前的错误行为
5. **环境信息**：
   - 操作系统版本
   - Node.js 版本
   - 应用版本

## 💡 功能建议

欢迎提交功能建议！请在 Issue 中详细说明：

1. **功能描述**：清晰描述新功能
2. **使用场景**：说明什么情况下需要此功能
3. **实现思路**：（可选）如何实现

## 🤝 Pull Request 流程

1. **Fork 仓库**
2. **创建分支**：`git checkout -b feature/amazing-feature`
3. **编写代码**：遵循代码规范
4. **测试**：确保所有测试通过
5. **提交**：遵循 Commit Message 规范
6. **推送**：`git push origin feature/amazing-feature`
7. **创建 PR**：填写清晰的 PR 描述

### PR 描述模板

```markdown
## 改动说明
简要说明本次 PR 的改动内容

## 改动类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化

## 相关 Issue
Close #xxx

## 测试
说明如何测试本次改动

## 截图（如果适用）
添加截图辅助说明
```

## 📚 参考资源

- [Electron 文档](https://www.electronjs.org/docs)
- [Notion API 文档](https://developers.notion.com/)
- [微信公众平台文档](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)

## 🙏 感谢

感谢所有为本项目做出贡献的开发者！

---

有任何问题，欢迎在 Issue 中讨论！

