# ☁️ 私有云盘 v3 — 项目说明文档

## 项目简介

一个 **纯 Node.js 实现的私有云存储服务**，单文件运行，没有任何第三方依赖。

### 核心功能

| 功能 | 说明 |
|------|------|
| 🔐 多用户登录 | Cookie + Session 认证，支持 8 个账号 |
| 📁 文件管理 | 浏览、上传、下载、删除、重命名、批量删除 |
| 🔍 搜索排序 | 客户端实时搜索 + 按名称/大小/时间排序 |
| 🖼️ 图片预览 | 点击图片直接预览，无需下载 |
| 📊 存储统计 | 显示磁盘空间使用情况 |
| 🌐 WebDAV | 支持映射为 Windows 网络驱动器 |
| 📂 公共文件夹 | 所有用户可读写的共享目录 |
| 📱 移动端适配 | 响应式 CSS，手机也能用 |

### 技术特点

- **零依赖**：只用 Node.js 内置模块（http、fs、path、url、crypto）
- **流式上传**：大文件写入临时文件，不占满内存
- **路径安全**：严格的路径穿越防护，用户只能访问自己的目录
- **Stream 下载**：大文件通过 fs.createReadStream 管道传输

---

## 文件说明

```
云盘项目源码/
├── server.js       ← 主程序（含详细注释）
└── README.md       ← 本文档
```

`server.js` 是一个约 1300 行的单文件程序，包含：

1. **服务端代码**（Node.js）：HTTP 服务器、路由处理、文件操作
2. **前端页面**（HTML/CSS/JS）：完整的文件管理器 SPA 界面

---

## 代码架构

```
server.js
│
├── 配置区
│   ├── PORT（端口：8080）
│   ├── ROOT（数据根目录）
│   ├── USERS（用户账号密码）
│   └── SESS（session 内存存储）
│
├── 工具函数
│   ├── mime()     — 文件类型 → MIME 映射
│   ├── F()        — 字节数 → 可读大小
│   ├── I()        — 文件图标 emoji
│   ├── rootFor()  — 用户根目录
│   ├── sp()       — URL → 绝对路径（含安全检查）
│   ├── sr()       — 路径规范化
│   ├── auth()     — Cookie 认证
│   └── dirSize()  — 递归计算目录大小
│
├── 核心模块
│   ├── parseMultipart()  — 流式 multipart 上传解析
│   ├── listDir()         — 目录列表+排序
│   ├── loginPage()       — 登录页 HTML
│   └── mainPage()        — 主界面 HTML（含前端 JS）
│
└── HTTP 路由
    ├── /login       — 登录页面
    ├── /logout      — 退出登录
    ├── /            — 主界面（文件浏览器）
    ├── /dl          — 文件下载
    ├── /preview     — 图片预览
    ├── /upload      — 文件上传
    ├── /api/ls      — 目录列表 API
    ├── /api/rename  — 重命名 API
    ├── /api/mkdir   — 创建文件夹 API
    ├── /api/del     — 删除 API
    ├── /api/bdel    — 批量删除 API
    └── /dav/*       — WebDAV 协议（PROPFIND/GET/PUT/DELETE/MKCOL）
```

---

## 部署说明

### 1. 前置条件

- Node.js 16+ 已安装
- 有足够的磁盘空间作为云盘存储

### 2. 启动服务

```bash
# 默认端口 8080，数据目录从代码中配置
node server.js

# 或指定端口和数据目录
CLOUD_ROOT=/home/user/clouddrive node server.js

# 指定管理员密码（否则使用默认密码）
CLOUD_PASS=yourpassword CLOUD_ROOT=/data/cloud node server.js
```

### 3. 配置 systemd 自启动（Linux）

创建 `/etc/systemd/system/clouddrive.service`：

```ini
[Unit]
Description=Private Cloud Drive
After=network.target

[Service]
Type=simple
User=hn
Environment=CLOUD_ROOT=/home/hn/clouddrive
Environment=CLOUD_PASS=yourpassword
ExecStart=/usr/bin/node /home/hn/clouddrive/公共文件夹/云盘项目源码/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable clouddrive
sudo systemctl start clouddrive
```

### 4. 访问

- 浏览器打开：`http://<服务器IP>:8080`
- Windows 映射网络驱动器：`http://<服务器IP>:8080/dav/`
- WebDAV 客户端（如 RaiDrive）：同上地址

---

## 用户管理

用户配置在 `server.js` 的 `USERS` 对象中：

```js
const USERS = {
  zh208522: 'password1',   // 管理员（访问全局根目录）
  wcz:      '12345678',
  // ... 添加更多用户
};
```

- **管理员**（`ADMIN = 'zh208522'`）：能看到所有用户的数据
- **普通用户**：只能访问自己的目录（`ROOT/<用户名>/`）
- **公共文件夹**：所有用户都能读写（`ROOT/公共文件夹/`）

---

## 常见问题

### Q: 上传大文件失败？
确保 `server.timeout = 0`（代码中已设置），且客户端网络稳定。

### Q: WebDAV 连不上？
- Windows 需要在注册表允许 Basic Auth over HTTP
- 或用 RaiDrive 等第三方客户端

### Q: 如何修改默认密码？
设置环境变量 `CLOUD_PASS=新密码` 并重启服务。

### Q: 端口被占用？
修改代码中的 `PORT` 常量，或用 `PORT=9090 node server.js` 启动。

---

## 更新日志

| 版本 | 日期 | 内容 |
|------|------|------|
| v3 | 2026-05 | 添加 WebDAV、流式上传、批量操作、搜索、移动端适配 |
| v2 | - | 多用户支持、SPA 界面 |
| v1 | - | 基础文件浏览和下载 |

---

> 🦀 蟹老板出品 | 私有云盘，数据掌握在自己手里
