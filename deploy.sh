#!/bin/bash
# ==========================================
# ☁️ 私有云盘 - 一键部署脚本
# 适用：Debian/Ubuntu/CentOS/Arch Linux
# ==========================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║   ☁️  私有云盘 一键部署          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"

# ── 1. 检查 / 安装 Node.js ──
if command -v node &>/dev/null; then
  echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
else
  echo -e "${CYAN}📦 安装 Node.js...${NC}"
  if command -v apt &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
    sudo yum install -y nodejs
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm nodejs npm
  else
    echo -e "${RED}请手动安装 Node.js 16+: https://nodejs.org${NC}"; exit 1
  fi
  echo -e "${GREEN}✓ Node.js 安装完成${NC}"
fi

# ── 2. 配置 ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${CLOUD_ROOT:-$HOME/clouddrive-data}"
ADMIN_USER="${CLOUD_ADMIN:-admin}"
ADMIN_PASS="${CLOUD_PASS:-admin123}"
PORT="${CLOUD_PORT:-8080}"

echo ""
echo -e "${CYAN}配置预览:${NC}"
echo "  端口:       $PORT"
echo "  数据目录:   $DATA_DIR"
echo "  管理员:     $ADMIN_USER"
echo "  管理员密码: $ADMIN_PASS"
echo ""

read -p "确认以上配置？(Y/n) " confirm
if [[ "$confirm" =~ ^[Nn] ]]; then
  echo "请设置环境变量后重试："
  echo "  export CLOUD_ROOT=/path/to/data"
  echo "  export CLOUD_ADMIN=yourname"
  echo "  export CLOUD_PASS=yourpassword"
  echo "  export CLOUD_PORT=8080"
  echo "  bash deploy.sh"
  exit 0
fi

# ── 3. 创建数据目录 ──
mkdir -p "$DATA_DIR"
echo -e "${GREEN}✓ 数据目录: $DATA_DIR${NC}"

# ── 4. 创建 systemd 服务 ──
SERVICE_FILE="$HOME/.config/systemd/user/clouddrive.service"
mkdir -p "$(dirname "$SERVICE_FILE")"

cat > "$SERVICE_FILE" << SERVICEEOF
[Unit]
Description=☁️ 私有云盘 File Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
Environment=CLOUD_ROOT=$DATA_DIR
Environment=CLOUD_ADMIN=$ADMIN_USER
Environment=CLOUD_PASS=$ADMIN_PASS
Environment=CLOUD_PORT=$PORT
ExecStart=$(which node) $SCRIPT_DIR/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
SERVICEEOF

echo -e "${GREEN}✓ systemd 服务已创建${NC}"

# ── 5. 启用并启动 ──
systemctl --user daemon-reload
systemctl --user enable clouddrive
systemctl --user restart clouddrive

echo ""
echo -e "${GREEN}╔══════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 部署完成！                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
echo ""
echo "  🌐 Web 访问:   http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$PORT"
echo "  🌐 WebDAV:     http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$PORT/dav/"
echo "  👤 登录账号:   $ADMIN_USER"
echo "  🔑 登录密码:   $ADMIN_PASS"
echo ""
echo "  管理命令:"
echo "    systemctl --user status clouddrive   查看状态"
echo "    systemctl --user restart clouddrive  重启服务"
echo "    systemctl --user stop clouddrive     停止服务"
echo "    journalctl --user -u clouddrive -f   查看日志"
