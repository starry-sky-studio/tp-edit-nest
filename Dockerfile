# ====================================
# Stage 1: Development/Builder
# ====================================
FROM node:22-alpine AS development

# 安装必要的工具，包括 curl（用于健康检查）
RUN apk add --no-cache curl openssl

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package 文件和配置
COPY package*.json ./
COPY prisma ./prisma/

# 安装所有依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# ====================================
# Stage 2: Development Runner (用于本地开发/调试)
# ====================================
FROM node:22-alpine AS development-runner
# 容器内也需要 openssl 和 curl
RUN apk add --no-cache curl openssl

WORKDIR /usr/src/app
# 复制 package 文件和构建结果 (用于生成后的启动)
COPY package*.json ./
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/dist ./dist
# 复制 Prisma Schema 和生成 Client 的脚本
COPY prisma ./prisma/

EXPOSE 3002

# 注意：在 docker-compose 中，我们通常会挂载卷，所以这里只作为基础镜像。
# 实际启动命令（在 docker-compose.yml 中定义）
CMD ["npm", "run", "start:dev"]


# ====================================
# Stage 3: Production (最终运行镜像)
# ====================================
FROM node:22-alpine AS production

# 安装 openssl（Prisma Client 需要）和 curl（健康检查需要）
RUN apk add --no-cache openssl curl

WORKDIR /usr/src/app

# 复制 package 文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装生产依赖（不安装 devDependencies）
RUN npm ci --only=production

# 复制构建后的文件
COPY --from=development /usr/src/app/dist ./dist

# 🚨 关键：在运行时镜像中生成 Prisma Client
# 确保生成的 client 依赖于容器内的 openssl 等环境
RUN npx prisma generate

EXPOSE 3002

# 健康检查 - 确保应用启动并响应
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# 生产环境启动命令
CMD ["node", "dist/main"]
