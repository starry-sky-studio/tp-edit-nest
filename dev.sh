#!/bin/bash

# ============================================
# 开发环境启动脚本
# ============================================
# 使用方法: ./dev.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "启动开发环境"
echo "==========================================${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行，请启动 Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 正在运行${NC}"

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

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: .env 文件不存在，从 .env.example 创建...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}请编辑 .env 文件并填写必需的环境变量${NC}"
    echo -e "${YELLOW}按 Enter 继续，或 Ctrl+C 取消...${NC}"
    read
fi

# 检查必需的环境变量
source .env
if [ -z "$OPENAI_API_KEY" ] || [ -z "$DEEPSEEK_API_KEY" ] || [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
    echo -e "${YELLOW}警告: AI API Keys 未配置，某些功能可能无法使用${NC}"
fi

# 步骤1: 构建镜像
echo ""
echo -e "${BLUE}[1/5] 构建 Docker 镜像...${NC}"
$DOCKER_COMPOSE build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 镜像构建成功${NC}"
else
    echo -e "${RED}✗ 镜像构建失败${NC}"
    exit 1
fi

# 步骤2: 停止现有容器
echo ""
echo -e "${BLUE}[2/5] 停止现有容器...${NC}"
$DOCKER_COMPOSE down || true

# 步骤3: 启动服务
echo ""
echo -e "${BLUE}[3/5] 启动服务...${NC}"
$DOCKER_COMPOSE up -d

# 步骤4: 等待服务启动
echo ""
echo -e "${BLUE}[4/5] 等待服务启动...${NC}"
sleep 10

# 步骤5: 运行数据库迁移
echo ""
echo -e "${BLUE}[5/5] 运行数据库迁移...${NC}"
$DOCKER_COMPOSE exec -T app npx prisma migrate deploy || {
    echo -e "${YELLOW}迁移失败，尝试生成 Prisma Client...${NC}"
    $DOCKER_COMPOSE exec -T app npx prisma generate
}

# 检查服务状态
echo ""
echo -e "${BLUE}检查服务状态...${NC}"
docker-compose ps

# 等待应用完全启动
echo ""
echo -e "${BLUE}等待应用完全启动...${NC}"
sleep 5

# 健康检查
echo ""
echo -e "${BLUE}执行健康检查...${NC}"
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
    echo -e "${RED}✗ 应用健康检查失败${NC}"
    echo "查看日志: $DOCKER_COMPOSE logs -f app"
    exit 1
fi

# 显示服务信息
echo ""
echo -e "${GREEN}=========================================="
echo "开发环境已启动！"
echo "==========================================${NC}"
echo ""
echo "服务地址:"
echo "  - 应用: http://localhost:3005"
echo "  - Swagger 文档: http://localhost:3005/api"
echo "  - 健康检查: http://localhost:3005/health"
echo "  - MinIO 控制台: http://localhost:9001"
echo ""
echo "数据库:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "常用命令:"
echo "  - 查看日志: $DOCKER_COMPOSE logs -f app"
echo "  - 停止服务: $DOCKER_COMPOSE down"
echo "  - 重启服务: $DOCKER_COMPOSE restart"
echo "  - 查看状态: $DOCKER_COMPOSE ps"
echo ""

