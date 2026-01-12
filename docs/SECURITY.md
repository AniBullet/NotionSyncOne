# 安全与隐私说明

## 🔒 数据安全

NotionSyncOne 非常重视您的数据安全和隐私保护。

### 本地存储

所有敏感信息都存储在您的本地计算机上：

**配置文件位置**：
- Windows: `C:\Users\您的用户名\AppData\Roaming\notionsyncone\config\config.json`
- macOS: `~/Library/Application Support/notionsyncone/config/config.json`
- Linux: `~/.config/notionsyncone/config/config.json`

**B站 Cookie 位置**：
- 临时目录: `系统临时目录/notionsyncone-bilibili/cookies.json`

### 加密存储 🔐

从 v1.1.0 开始，NotionSyncOne 使用 **系统级加密** 保护敏感配置：

**加密技术**：
- **Windows**: DPAPI (Data Protection API)
- **macOS**: Keychain Services
- **Linux**: libsecret / gnome-keyring

**加密的字段**：
- ✅ Notion API Key
- ✅ 微信公众号 AppId & AppSecret
- ✅ WordPress 应用密码

**安全特性**：
- 🔒 只有当前用户在当前电脑上才能解密
- 🔒 配置文件即使泄露也无法被他人读取
- 🔒 自动迁移：首次运行时会自动加密旧配置
- 🔒 完全透明：使用时无需手动加密/解密

**配置文件示例**（加密后）：
```json
{
  "notion": {
    "apiKey": "[encrypted]AQAAANCMnd8BFdERjHoAwE/Cl+sBAAAA...",
    "databaseId": "12345678-1234-1234-1234-123456789abc"
  },
  "wechat": {
    "appId": "[encrypted]AQAAANCMnd8BFdERjHoAwE/Cl+sBAAAA...",
    "appSecret": "[encrypted]AQAAANCMnd8BFdERjHoAwE/Cl+sBAAAA..."
  }
}
```

> ⚠️ **注意**：以上为示例数据，请勿使用真实配置作为文档示例

### 存储的敏感信息

1. **Notion API Key** - 用于访问您的 Notion 数据（✅ 已加密）
2. **微信公众号密钥** - AppId 和 AppSecret（✅ 已加密）
3. **WordPress 应用密码** - 用于 REST API 访问（✅ 已加密）
4. **B站登录 Cookie** - 通过 biliup 工具管理（⚠️ 文件权限保护）

### 安全措施

✅ **系统级加密** - 敏感配置使用操作系统提供的加密服务
✅ **本地存储** - 所有敏感数据仅存储在本地
✅ **不上传到云端** - 配置文件不会上传到任何服务器
✅ **文件权限** - Cookie 文件设置为仅当前用户可读写（chmod 600）
✅ **日志脱敏** - 日志中不输出完整的 API Key 或密码
✅ **Git 忽略** - `.gitignore` 已配置忽略所有敏感文件
✅ **自动迁移** - 旧的明文配置会自动升级到加密存储

### 不安全的操作

❌ **不要**将配置文件分享给他人
❌ **不要**将配置文件提交到 Git 仓库
❌ **不要**在公共场所展示配置界面
❌ **不要**截图包含 API Key 的界面

### 第三方工具

**biliup-rs**：
- 开源工具，代码可审计
- Cookie 本地存储
- 不会上传任何数据到非B站服务器
- 项目地址: https://github.com/biliup/biliup

**FFmpeg**：
- 开源视频处理工具
- 仅用于本地视频压缩
- 不涉及网络传输

### API 密钥安全

#### Notion API Key
- 仅用于访问您授权的 Notion 数据库
- 不会发送到 Notion 以外的服务器
- 建议定期更换

#### 微信公众号密钥
- 仅用于调用微信公众平台 API
- 不会发送到微信以外的服务器
- 妥善保管，避免泄露

#### WordPress 应用密码
- 建议使用应用密码而非主账号密码
- 可随时在 WordPress 后台撤销
- 不会被明文存储在日志中

#### B站账号
- 通过 biliup 官方登录流程
- Cookie 本地加密存储
- 不会被上传到第三方服务器

### 审计和日志

应用日志位置：
- Windows: `C:\Users\您的用户名\AppData\Roaming\notionsyncone\logs\`
- macOS: `~/Library/Application Support/notionsyncone/logs/`
- Linux: `~/.config/notionsyncone/logs/`

日志中**不包含**：
- ❌ 完整的 API Key
- ❌ 密码明文
- ❌ Cookie 内容
- ❌ 用户个人信息

日志中**包含**：
- ✅ 操作记录（如同步开始/结束）
- ✅ 错误信息（已脱敏）
- ✅ 文章标题和 ID
- ✅ 同步状态

### 如果怀疑密钥泄露

如果您怀疑密钥已泄露，请立即：

1. **Notion API Key**：
   - 前往 https://www.notion.so/my-integrations
   - 撤销或重新生成 API Key

2. **微信公众号**：
   - 登录微信公众平台
   - 重置 AppSecret

3. **WordPress**：
   - 登录 WordPress 后台
   - 撤销应用密码并重新生成

4. **B站账号**：
   - 删除本地 Cookie 文件
   - 重新登录

### 开源透明

NotionSyncOne 是开源软件：
- 源代码公开可审计
- 不包含任何后门或追踪代码
- 不会收集用户隐私数据
- 不会向第三方发送数据

项目地址: https://github.com/AniBullet/NotionSyncOne

### 联系方式

如发现安全漏洞，请通过以下方式报告：
- GitHub Issues: https://github.com/AniBullet/NotionSyncOne/issues
- 标题标注: [SECURITY]

---

**最后更新**: 2026-01-12  
**版本**: v1.1.0
