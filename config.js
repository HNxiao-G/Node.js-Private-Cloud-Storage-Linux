// ==========================================
// ☁️ 私有云盘 配置文件
// ==========================================
// 修改此文件后重启服务即可生效
// 也可以用环境变量覆盖（优先级更高）

module.exports = {
  // 服务端口
  port: process.env.CLOUD_PORT || 8080,

  // 数据根目录（存放用户文件和公共文件夹）
  root: process.env.CLOUD_ROOT || './data',

  // 管理员用户名
  admin: process.env.CLOUD_ADMIN || 'admin',

  // 初始用户列表（密码会在首次运行后持久化到 .users.json）
  users: {
    admin: process.env.CLOUD_PASS || 'admin123',
    // 在此添加更多用户，例如：
    // user1: 'password1',
    // user2: 'password2',
  },

  // Session 有效期（毫秒），默认 24 小时
  sessionTTL: 86400000,
};
