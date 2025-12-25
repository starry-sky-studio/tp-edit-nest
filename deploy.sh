#!/bin/bash

# ============================================
# 生产环境部署脚本
# ============================================
# 使用方法: ./deploy.sh

set -e  # 遇到错误立即退出（Nginx 配置部分会临时关闭）

echo "=========================================="
echo "开始部署 tp-edit-nest 应用"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo -e "${RED}错误: .env 文件不存在！${NC}"
    echo "请先复制 .env.example 并配置环境变量:"
    echo "  cp .env.example .env"
    echo "  nano .env  # 编辑并填写所有必需的环境变量"
    exit 1
fi

# 检查必需的环境变量
echo -e "${YELLOW}检查环境变量...${NC}"
source .env

required_vars=(
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "MINIO_ROOT_USER"
    "MINIO_ROOT_PASSWORD"
    "OPENAI_API_KEY"
    "DEEPSEEK_API_KEY"
    "GOOGLE_GENERATIVE_AI_API_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}错误: 以下必需的环境变量未设置:${NC}"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

echo -e "${GREEN}环境变量检查通过${NC}"

# 检测 Docker Compose 命令（新版本使用 docker compose，旧版本使用 docker-compose）
if docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose --version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}错误: 未找到 docker compose 或 docker-compose 命令${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 使用命令: $DOCKER_COMPOSE${NC}"

  # 使用生产环境配置（已自动优化内存）
  COMPOSE_FILE="docker-compose.prod.yaml"

  # 停止现有容器
  echo -e "${YELLOW}停止现有容器...${NC}"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" down || true

  # 构建镜像
  echo -e "${YELLOW}构建 Docker 镜像...${NC}"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" build --no-cache

  # 启动服务
  echo -e "${YELLOW}启动服务...${NC}"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 15

# 等待应用容器稳定（不再重启）
echo -e "${YELLOW}等待应用容器稳定...${NC}"
max_wait=60
wait_count=0
while [ $wait_count -lt $max_wait ]; do
    container_status=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" ps app --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "restarting")
    if [ "$container_status" = "running" ]; then
        # 再等待几秒确保完全启动
        sleep 5
        echo -e "${GREEN}✓ 应用容器已稳定运行${NC}"
        break
    fi
    wait_count=$((wait_count + 1))
    echo "等待容器稳定... ($wait_count/$max_wait) (状态: $container_status)"
    sleep 2
done

if [ $wait_count -eq $max_wait ]; then
    echo -e "${RED}✗ 应用容器未能稳定运行，查看日志:${NC}"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs --tail=50 app
    echo ""
    echo -e "${YELLOW}提示: 请检查应用日志，可能是数据库连接、环境变量或其他配置问题${NC}"
    exit 1
fi

  # 运行数据库迁移
  echo -e "${YELLOW}运行数据库迁移...${NC}"
  # 重试机制：最多尝试 3 次
  for i in 1 2 3; do
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T app npx prisma migrate deploy; then
      echo -e "${GREEN}✓ 数据库迁移成功${NC}"
      break
    else
      if [ $i -eq 3 ]; then
        echo -e "${YELLOW}迁移失败，尝试生成 Prisma Client...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T app npx prisma generate || true
      else
        echo -e "${YELLOW}迁移失败，重试中... ($i/3)${NC}"
        sleep 5
      fi
    fi
  done

  # 检查服务状态
  echo -e "${YELLOW}检查服务状态...${NC}"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps

# 等待应用完全启动
echo -e "${YELLOW}等待应用完全启动...${NC}"
sleep 10

# 健康检查
echo -e "${YELLOW}执行健康检查...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:3005/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 应用健康检查通过${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "等待应用启动... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ 应用健康检查失败，请查看日志:${NC}"
    echo "  $DOCKER_COMPOSE -f $COMPOSE_FILE logs app"
    exit 1
fi

# 显示使用的配置文件
echo -e "${GREEN}使用的配置文件: $COMPOSE_FILE${NC}"

# 自动配置 Nginx（如果配置文件存在）
# 注意：这部分使用 set +e 避免因 Nginx 配置失败而中断部署
set +e
if [ -f "nginx.conf" ]; then
    echo ""
    echo -e "${YELLOW}配置 Nginx 反向代理...${NC}"

    # 检查是否以 root 运行（Nginx 配置需要 root）
    if [ "$EUID" -eq 0 ]; then
        # 安装 Nginx（如果未安装）
        if ! command -v nginx &> /dev/null; then
            echo -e "${YELLOW}安装 Nginx...${NC}"
            if command -v yum &> /dev/null; then
                yum install -y nginx 2>/dev/null || true
            elif command -v apt-get &> /dev/null; then
                apt-get update -qq && apt-get install -y nginx 2>/dev/null || true
            fi
        fi

        # 检测 Nginx 配置目录（CentOS/RHEL 使用 conf.d，Ubuntu/Debian 使用 sites-available）
        NGINX_CONFIG_DIR=""
        if [ -d "/etc/nginx/conf.d" ]; then
            # CentOS/RHEL
            NGINX_CONFIG_DIR="/etc/nginx/conf.d"
            NGINX_CONFIG_FILE="$NGINX_CONFIG_DIR/tp-edit-nest.conf"
        elif [ -d "/etc/nginx/sites-available" ]; then
            # Ubuntu/Debian
            NGINX_CONFIG_DIR="/etc/nginx/sites-available"
            NGINX_CONFIG_FILE="$NGINX_CONFIG_DIR/tp-edit-nest"
            ENABLED_FILE="/etc/nginx/sites-enabled/tp-edit-nest"
        else
            echo -e "${YELLOW}⚠ 无法确定 Nginx 配置目录，跳过自动配置${NC}"
        fi

        if [ -n "$NGINX_CONFIG_DIR" ]; then
            # 复制配置文件
            cp nginx.conf "$NGINX_CONFIG_FILE" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ Nginx 配置文件已复制到 $NGINX_CONFIG_FILE${NC}"

                # Ubuntu/Debian 需要创建符号链接
                if [ -n "$ENABLED_FILE" ] && [ ! -L "$ENABLED_FILE" ]; then
                    ln -s "$NGINX_CONFIG_FILE" "$ENABLED_FILE" 2>/dev/null || true
                fi

                # 测试配置
                if nginx -t > /dev/null 2>&1; then
                    systemctl start nginx 2>/dev/null || true
                    systemctl enable nginx 2>/dev/null || true
                    systemctl reload nginx 2>/dev/null || true
                    echo -e "${GREEN}✓ Nginx 已启动并重载${NC}"

                    # 配置防火墙（如果存在）
                    if command -v firewall-cmd &> /dev/null; then
                        firewall-cmd --permanent --add-service=http 2>/dev/null || true
                        firewall-cmd --permanent --add-service=https 2>/dev/null || true
                        firewall-cmd --reload 2>/dev/null || true
                        echo -e "${GREEN}✓ 防火墙已配置${NC}"
                    elif command -v ufw &> /dev/null; then
                        ufw allow 80/tcp 2>/dev/null || true
                        ufw allow 443/tcp 2>/dev/null || true
                        echo -e "${GREEN}✓ 防火墙已配置${NC}"
                    fi
                    NGINX_CONFIGURED=true
                else
                    echo -e "${YELLOW}⚠ Nginx 配置测试失败，请手动检查: nginx -t${NC}"
                fi
            fi
        fi
    else
        echo -e "${YELLOW}⚠ 需要 root 权限配置 Nginx，请手动运行:${NC}"
        echo "  sudo cp nginx.conf /etc/nginx/conf.d/tp-edit-nest.conf"
        echo "  sudo nginx -t && sudo systemctl reload nginx"
    fi
fi
set -e

# 获取服务器 IP
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

# 显示服务信息
echo ""
echo -e "${GREEN}=========================================="
echo "部署完成！"
echo "==========================================${NC}"
echo ""
echo "服务信息:"
echo "  - 本地访问: http://localhost:3005"
if [ "$NGINX_CONFIGURED" = "true" ]; then
    echo "  - 外部访问: http://$SERVER_IP"
    echo "  - Swagger: http://$SERVER_IP/api"
    echo "  - 健康检查: http://$SERVER_IP/health"
else
    echo "  - 外部访问: 需要配置 Nginx"
    echo "    手动配置: sudo cp nginx.conf /etc/nginx/conf.d/tp-edit-nest.conf"
    echo "               sudo nginx -t && sudo systemctl reload nginx"
fi
echo ""
echo "常用命令:"
echo "  - 查看日志: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f app"
echo "  - 停止服务: $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "  - 重启服务: $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "  - 查看状态: $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
echo "  - 查看资源: docker stats"
echo ""

