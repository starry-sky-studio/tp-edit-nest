# ====================================
# Stage 1: Development/Builder
# ====================================
FROM node:22-alpine AS development

# 1. 安装必要的工具 openssl 和 curl
# 2. 全局安装 pnpm
RUN apk add --no-cache curl openssl \
    && npm install -g pnpm

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package 文件和配置
# ⚠️ 注意: 确保您的构建上下文中包含 package.json, pnpm-lock.yaml 和 prisma 目录
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装所有依赖。使用 pnpm install --frozen-lockfile 替代 pnpm ci
# --frozen-lockfile 确保严格按照 pnpm-lock.yaml 安装，类似于 npm ci
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# ====================================
# Stage 2: Development Runner (用于本地开发/调试)
# ====================================
FROM node:22-alpine AS development-runner
# 容器内也需要 openssl 和 curl
RUN apk add --no-cache curl openssl
# 确保 pnpm 在此阶段也可用，以便将来如果需要在这里执行 pnpm 命令
RUN npm install -g pnpm

WORKDIR /usr/src/app
# 复制 package 文件和构建结果 (用于生成后的启动)
COPY package.json pnpm-lock.yaml ./
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/dist ./dist
# 复制 Prisma Schema 和生成 Client 的脚本
COPY prisma ./prisma/

EXPOSE 3002

# 启动命令使用 pnpm (如果您的 start:dev 命令是 pnpm start:dev)
CMD ["pnpm", "run", "start:dev"]


# ====================================
# Stage 3: Production (最终运行镜像)
# ====================================
FROM node:22-alpine AS production

# 安装 openssl（Prisma Client 需要）和 curl（健康检查需要）
RUN apk add --no-cache openssl curl
# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /usr/src/app

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装生产依赖
# ⚠️ 注意: pnpm install --prod 或 pnpm install --only=prod 是正确的生产安装方式
RUN pnpm install --only=prod --frozen-lockfile

# 复制构建后的文件
COPY --from=development /usr/src/app/dist ./dist

# 🚨 关键：在运行时镜像中生成 Prisma Client
# 确保生成的 client 依赖于容器内的 openssl 等环境
# 注意：npx 是 npm 的工具，这里应该使用 pnpm exec 或直接调用 npx (它在 node 镜像中可用)
RUN npx prisma generate

EXPOSE 3002

# 健康检查 - 确保应用启动并响应
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# 生产环境启动命令
CMD ["node", "dist/main"]
