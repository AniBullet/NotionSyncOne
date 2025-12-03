# 🔒 安全说明

## 隐私与数据保护

### ✅ 已实施的安全措施

本项目实施了以下安全措施来保护您的敏感信息：

1. **本地存储加密配置**
   - 所有 API 密钥（Notion API Key、WeChat AppID/AppSecret）存储在本地配置文件中
   - 配置文件路径：`%APPDATA%/notionsyncwechat/config/config.json`
   - 该目录已被 `.gitignore` 排除，不会被提交到代码仓库

2. **日志安全（已优化）**
   - ✅ 实施日志级别控制 - 生产环境自动禁用调试日志
   - ✅ 所有日志输出已经过滤，不会记录完整的 API 密钥、Token 或敏感配置
   - ✅ 日志仅显示配置状态（已配置/未配置），不显示实际值
   - ✅ 使用环境变量控制：开发模式显示详细日志，生产模式最小化输出

3. **网络请求**
   - API 密钥仅用于与官方 API 通信（Notion API、WeChat API）
   - 不会将密钥发送到任何第三方服务器
   - 所有网络请求使用 HTTPS 加密传输

### 最佳实践建议

1. **定期更换密钥**
   - 建议定期更换 API 密钥以增强安全性
   - 在 Notion 和微信公众平台的设置中可以重新生成密钥

2. **限制权限**
   - Notion Integration 仅授权访问必要的数据库
   - 微信公众号 API 权限设置为最小必需权限

3. **保护配置文件**
   - 不要将配置文件分享给他人
   - 如果需要备份，请加密存储
   - 如果怀疑密钥泄露，请立即更换

## 报告安全问题

如果您发现任何安全漏洞，请通过以下方式联系：

- GitHub Issues: [https://github.com/AniBullet/notionsyncwechat/issues](https://github.com/AniBullet/notionsyncwechat/issues)
- 请在问题标题中标注 `[Security]` 前缀

我们会尽快响应并修复安全问题。

## 更新日志

### 2025-12-01
- ✅ 移除所有可能泄露 API 密钥的日志输出
- ✅ 实施配置文件本地加密存储
- ✅ 添加 `.gitignore` 规则保护配置目录
- ✅ 优化日志输出，仅显示配置状态
