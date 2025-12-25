# ====================================
# Stage 1: Development/Builder
# ====================================
# 使用官方镜像（如果遇到限流问题，可以配置 Docker 镜像加速器）
# 备选镜像源：
# - registry.cn-hangzhou.aliyuncs.com/acs/node:22-alpine
# - docker.mirrors.ustc.edu.cn/library/node:22-alpine
FROM node:22-alpine AS development

# 安装必要的工具 openssl 和 curl，全局安装 pnpm
RUN apk add --no-cache curl openssl \
    && npm install -g pnpm

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package 文件和 Prisma Schema
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装所有依赖
RUN pnpm install --frozen-lockfile \
    && pnpm store prune \
    && rm -rf /root/.pnpm-store

# 🚨 关键：在构建前生成 Prisma Client（使用 pnpm 确保使用正确的版本）
RUN pnpm exec prisma generate

# 复制源代码（包括 tsconfig 等构建配置）
COPY . .

# 构建应用（此时 Prisma Client 已生成）
RUN pnpm run build

# 验证构建产物是否存在
RUN ls -la dist/ || (echo "构建失败：dist 目录不存在" && exit 1)
RUN test -f dist/main.js || (echo "构建失败：dist/main.js 不存在" && exit 1)

# ====================================
# Stage 2: Development Runner (用于本地开发/调试)
# ====================================
FROM node:22-alpine AS development-runner

# 安装必要的工具
RUN apk add --no-cache curl openssl \
    && npm install -g pnpm

WORKDIR /usr/src/app

# 复制 package 文件和构建结果
COPY package.json pnpm-lock.yaml ./
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/prisma ./prisma

EXPOSE 3005

# 启动命令（开发模式，支持热重载）
CMD ["pnpm", "run", "start:dev"]

# ====================================
# Stage 3: Production (最终运行镜像)
# ====================================
FROM node:22-alpine AS production

# 安装 openssl（Prisma Client 需要）和 curl（健康检查需要）
RUN apk add --no-cache openssl curl \
    && npm install -g pnpm

WORKDIR /usr/src/app

# 复制 package 文件和 Prisma Schema
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装生产依赖（使用 --no-optional 减少安装包）
RUN pnpm install --only=prod --frozen-lockfile --no-optional

# 单独安装 Prisma CLI（在 devDependencies 中，但生成 Client 需要它）
# 使用与 @prisma/client 匹配的版本（^6.19.0），确保版本一致
RUN pnpm add -D prisma@^6.19.0 --no-optional

# 复制构建后的文件
COPY --from=development /usr/src/app/dist ./dist

# 验证 dist 目录和 main.js 是否存在
RUN ls -la dist/ || (echo "错误：dist 目录不存在" && exit 1)
RUN test -f dist/main.js || (echo "错误：dist/main.js 不存在" && exit 1)

# 🚨 关键：在运行时镜像中生成 Prisma Client
# 使用 pnpm exec 确保使用指定的 Prisma 版本（6.x），而不是 npx 安装的最新版本
RUN pnpm exec prisma generate

EXPOSE 3005

# 健康检查 - 确保应用启动并响应
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3005/api/health || exit 1

# 生产环境启动命令（注意：构建后的文件在 dist/main.js）
CMD ["node", "dist/main.js"]
