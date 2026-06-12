# ☁️ 私有云盘 CloudDrive

一个 **纯 Node.js、零第三方依赖** 的私有云存储服务。

📦 单文件运行 | 🔐 多用户认证 | 🌐 WebDAV 支持 | 📱 移动端适配 | 📂 文件夹拖拽上传

## ✨ 功能特性

- 🔐 **多用户系统** — Cookie/Session 认证，管理员可增删用户、修改密码
- 📁 **文件管理** — 浏览、上传、下载、删除、重命名、批量操作
- 👁 **文件预览** — 左侧栏实时预览图片、文本，支持放大
- 📂 **文件夹拖拽上传** — 支持拖拽整个文件夹，保留目录结构
- 🔍 **搜索排序** — 客户端实时搜索 + 按名称/大小/时间排序
- 🖼️ **图片预览** — 点击放大查看
- 📦 **文件夹打包下载** — 选择文件夹一键打包 ZIP 下载
- 📊 **存储统计** — 实时显示磁盘使用情况
- 🌐 **WebDAV** — 支持映射为 Windows/macOS 网络驱动器
- 📂 **公共文件夹** — 所有用户可读写的共享空间
- 📱 **移动端** — 响应式设计，手机浏览器也能用
- ⚡ **零依赖** — 只用 Node.js 内置模块，无需 npm install

## 🚀 快速部署

### 方式一：一键部署（推荐）

```bash
chmod +x deploy.sh
./deploy.sh
```

按提示确认配置即可，自动完成 Node.js 安装、systemd 服务注册、启动。

### 方式二：手动启动

```bash
# 配置环境变量（可选，有默认值）
export CLOUD_ROOT=/home/user/clouddrive   # 数据目录，默认 ./data
export CLOUD_ADMIN=admin                   # 管理员用户名，默认 admin
export CLOUD_PASS=mypassword               # 管理员密码，默认 admin123
export CLOUD_PORT=8080                     # 端口，默认 8080

# 启动服务
node server.js
```

### 方式三：systemd 服务

```bash
# 创建服务文件 ~/.config/systemd/user/clouddrive.service
# 参考 deploy.sh 中的模板
systemctl --user daemon-reload
systemctl --user enable --now clouddrive
```

## 🌐 访问

- **Web 页面**: `http://<服务器IP>:8080`
- **WebDAV**: `http://<服务器IP>:8080/dav/`

### WebDAV 映射网络驱动器

- **Windows**: 推荐使用 [RaiDrive](https://www.raidrive.com/) 或直接映射（需改注册表允许 Basic Auth over HTTP）
- **macOS**: Finder → 前往 → 连接服务器 → 输入 WebDAV 地址
- **Linux**: 使用 davfs2: `sudo mount -t davfs http://IP:8080/dav/ /mnt/cloud`

## 📋 用户管理

管理员登录后，右侧管理面板可以：

- 添加新用户
- 修改任意用户密码
- 删除用户

用户数据持久化存储在数据目录的 `.users.json` 文件中。

### 默认用户

| 用户名 | 密码 | 权限 |
|--------|------|------|
| admin | admin123 | 管理员（全局访问） |

## 🏗️ 项目结构

```
clouddrive/
├── server.js       # 主程序（约1400行，含前端界面）
├── config.js       # 配置模板（可选，参考用）
├── deploy.sh       # 一键部署脚本
└── README.md       # 本文档
```

**无外部依赖！** `server.js` 是完整的自包含程序，只需 Node.js 16+ 即可运行。

## 🔧 配置说明

所有配置通过环境变量设置：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `CLOUD_ROOT` | `./data` | 数据存储根目录 |
| `CLOUD_ADMIN` | `admin` | 管理员用户名 |
| `CLOUD_PASS` | `admin123` | 管理员初始密码 |
| `CLOUD_PORT` | `8080` | 服务端口 |

## 📐 技术架构

```
server.js
├── 配置区 — 端口、路径、用户
├── 工具函数 — MIME、格式化、路径安全
├── 认证模块 — Cookie/Session 管理
├── 文件操作 — 列表、增删改、上传下载
├── WebDAV — PROPFIND/GET/PUT/DELETE/MKCOL
├── HTTP 路由 — /login /api/ls /dl /upload /dav/*
├── 前端界面 — HTML/CSS/JS SPA（内嵌在 server.js 中）
└── ZIP 打包 — 调用系统 zip 命令
```

## 🛡️ 安全特性

- 严格的路径穿越防护（`path.normalize` + 前缀检查）
- Session 24小时自动过期
- HttpOnly Cookie 防 XSS
- 用户隔离：普通用户只能访问自己的目录
- 文件上传大小无硬限制（靠磁盘空间）

## 📝 许可证

MIT License — 自由使用、修改、分发。

---

> 🦀 蟹老板出品 | 数据掌握在自己手里
