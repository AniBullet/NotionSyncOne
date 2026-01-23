# 🚀 快速开始指南

## 5 分钟上手 NotionSyncOne

### 第一步：准备 Notion 数据库

#### 1. 创建数据库

在 Notion 中创建一个新数据库（Database），作为你的文章库。

#### 2. 添加必需字段

确保数据库包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| **Title** | 标题 | 文章标题（默认字段） |
| **AddedTime** | 日期 | 添加时间，用于排序 |

**字段创建方法**：
- 点击数据库表头的「+」按钮
- 选择字段类型（如「日期」）
- 输入字段名称（注意大小写）

#### 3. 添加测试文章

在数据库中新建一条记录：
- **Title**：输入文章标题，如「我的第一篇测试文章」
- **AddedTime**：选择今天的日期
- 点击标题打开页面，添加一些内容（文字、图片等）

---

### 第二步：创建 Notion Integration

#### 1. 创建 Integration

1. 访问 [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. 点击「+ New integration」
3. 填写信息：
   - **Name**：NotionSyncOne（或任意名称）
   - **Associated workspace**：选择你的工作区
4. 点击「Submit」
5. 复制显示的 **Internal Integration Token**（这就是 API Key）

#### 2. 授权 Integration 访问数据库

⚠️ **重要步骤**（很多人会遗漏）：

1. 打开你创建的数据库页面
2. 点击右上角「···」（三个点）
3. 选择「添加连接」（Add connections）
4. 在列表中找到并选择你刚创建的 Integration

> 💡 **提示**：如果不完成这步，应用会提示「找不到指定的数据库」

#### 3. 获取 Database ID

从数据库 URL 中提取 Database ID：

**URL 示例**：
```
https://www.notion.so/workspace/abc123def456?v=789xyz
```

**Database ID**：`abc123def456`（问号前面的部分）

---

###第三步：配置应用

#### 1. 启动应用

- 如果是安装版：从开始菜单打开 NotionSyncOne
- 如果是源码运行：执行 `pnpm dev`

#### 2. 配置 Notion

1. 点击左侧菜单的「配置」
2. 在 **Notion** 配置区域：
   - **API Key**：粘贴刚才复制的 Integration Token
   - **Database ID**：粘贴从 URL 提取的 Database ID
3. 点击「保存配置」

#### 3. 测试连接

1. 返回「主页」
2. 点击「刷新文章列表」
3. 如果配置正确，你应该能看到刚才创建的测试文章

🎉 **成功**！Notion 连接已完成。

---

### 第四步：配置发布平台（可选）

根据需要配置一个或多个发布平台：

<details>
<summary><b>配置微信公众号</b></summary>

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「设置与开发」→「基本配置」
3. 复制 **AppID** 和 **AppSecret**
4. 在应用「配置」页面的 **微信公众号** 区域填入
5. 点击「保存配置」

**可选配置**（JSON格式）：
```json
{
  "appId": "你的AppID",
  "appSecret": "你的AppSecret",
  "theme": "wechat",
  "titleTemplate": "【转载】{title}"
}
```

**theme 可选值**：`default`、`wechat`、`hongfei`、`jianhei`、`shanchui`、`chengxin`

**titleTemplate**：标题模板，使用 `{title}` 代表原标题
- 示例：`【转载】{title}` - 添加前缀
- 示例：`{title}【精选】` - 添加后缀
- 留空则使用原标题

</details>

<details>
<summary><b>配置 WordPress</b></summary>

1. 登录 WordPress 后台
2. 进入「用户」→「个人资料」→「应用密码」
3. 添加新应用密码，复制生成的密码
4. 在应用「配置」页面的 **WordPress** 区域填入：
   - **站点 URL**：`https://你的网站.com`
   - **用户名**：WordPress 用户名
   - **应用密码**：刚才复制的密码
5. 点击「保存配置」

**可选配置**：
- **标题模板**：使用 `{title}` 代表原标题，例如 `【转载】{title}`
- **顶部提示语**：在文章顶部显示的提示文字

</details>

<details>
<summary><b>配置 Bilibili（视频投稿）</b></summary>

**前置要求**：安装 `biliup-rs` 和 `FFmpeg`

```bash
# Windows 用户
winget install biliup
winget install BtbN.FFmpeg.GPL
```

**登录 B站**：

```bash
biliup login
```

扫码登录后，应用就能自动使用这个账号投稿了。

**可选配置**：
- **标题模板**：使用 `{title}` 代表原标题，例如 `【转载】{title}`
- **简介模板**：支持变量 `{title}` `{url}` `{date}` `{from}` `{author}` `{engine}` `{rate}` `{tags}`
- **默认分区和标签**：为所有投稿设置默认值

</details>

---

### 第五步：同步文章

#### 1. 刷新文章列表

在「主页」点击「刷新」，确保文章列表是最新的。

#### 2. 选择文章并同步

1. 在文章列表中找到要发布的文章
2. 点击对应平台的同步按钮：
   - 🟢 **微信** - 同步到微信公众号草稿箱
   - 🔵 **WordPress** - 发布到 WordPress
   - 🎬 **B站** - 提取视频并投稿（如果文章包含视频）
3. 查看日志输出，等待同步完成

#### 3. 检查结果

- **微信**：登录微信公众平台，进入「草稿箱」查看
- **WordPress**：访问网站后台，查看「文章」列表
- **B站**：登录 B站，进入「投稿管理」查看

---

## 💡 使用技巧

### 1. 批量同步

可以快速连续点击多个文章的同步按钮，应用会按顺序处理。

### 2. 中断同步

如果同步过程中需要中断，点击「停止同步」按钮。

### 3. 查看同步历史

应用会记录每篇文章的同步状态，已同步的文章会显示对应图标。

### 4. 多平台同步

同一篇文章可以同时同步到多个平台，互不影响。

### 5. 图片处理

- 应用会自动处理 Notion 中的图片
- 微信：图片会上传到微信素材库
- WordPress：图片会上传到媒体库
- 无需手动下载或上传图片

### 6. 封面图设置

- Notion 页面的封面图会自动作为文章封面
- 支持 Notion 自带封面和自定义上传的图片

### 7. 标题模板

在设置中可为每个平台配置标题模板：
- 使用 `{title}` 代表原标题
- 示例：`【转载】{title}` - 为所有同步的文章添加前缀
- 示例：`{title}【精选】` - 添加后缀
- 每个平台可以单独配置不同的模板

---

## 🐛 遇到问题？

### 常见错误

| 错误提示 | 原因 | 解决方法 |
|---------|------|---------|
| 找不到指定的数据库 | Integration 未授权 | 在数据库页面「添加连接」 |
| 无权访问该数据库 | API Key 错误或权限不足 | 检查 API Key 是否正确 |
| 数据库 ID 格式不正确 | Database ID 错误 | 重新从 URL 复制 Database ID |
| 微信 IP 未加白名单 | IP 未配置 | 在微信公众平台添加服务器 IP |
| WordPress 认证失败 | 应用密码错误 | 重新生成应用密码 |

### 获取更多帮助

- 📖 [完整文档](../README.md)
- 🔒 [安全说明](./SECURITY.md)
- 🚀 [部署指南](./DEPLOY.md)
- 📋 [更新日志](./CHANGELOG.md)
- 🐛 [报告问题](https://github.com/AniBullet/NotionSyncOne/issues)

---

## 🎉 开始创作吧！

现在你已经完成了所有配置，可以：

1. 在 Notion 中自由创作内容
2. 一键同步到各个平台
3. 享受高效的内容分发流程

**祝你使用愉快！** 🚀
