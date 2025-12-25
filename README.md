# TP Edit Nest

基于 NestJS 的后端服务，提供 AI 文本生成、用户认证、文件管理等核心功能。

## ✨ 特性

- 🤖 **多模型 AI 支持** - 支持 OpenAI、DeepSeek、Google Gemini 等多种 AI 模型
- 🔄 **流式响应** - 使用 Server-Sent Events (SSE) 实现实时流式文本生成
- 🔐 **用户认证** - JWT 认证，支持本地登录和 OAuth 第三方登录
- 📁 **文件管理** - 基于 MinIO 的对象存储服务
- 💾 **数据持久化** - 使用 Prisma ORM + PostgreSQL
- ⚡ **缓存支持** - Redis 缓存提升性能
- 📚 **API 文档** - 集成 Swagger，自动生成 API 文档

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **框架** | NestJS 10 | 现代化 Node.js 框架，支持模块化、依赖注入 |
| **数据库** | PostgreSQL | 关系型数据库 |
| **ORM** | Prisma 6 | 类型安全的数据库访问工具 |
| **缓存** | Redis | 内存数据库，用于缓存和会话管理 |
| **对象存储** | MinIO | S3 兼容的对象存储服务 |
| **AI SDK** | Vercel AI SDK | 统一的 AI 模型调用接口 |
| **认证** | JWT | JSON Web Token 认证 |
| **API 文档** | Swagger | 自动生成 API 文档 |
| **流式响应** | RxJS | 基于 Observable 的流式数据处理 |

## 📦 项目结构

```
tp-edit-nest/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── app.module.ts           # 根模块
│   ├── modules/                # 业务模块
│   │   ├── ai/                 # AI 文本生成模块
│   │   │   ├── ai.controller.ts
│   │   │   ├── ai.service.ts
│   │   │   └── dto/
│   │   ├── auth/               # 认证模块
│   │   ├── user/               # 用户管理模块
│   │   └── files/              # 文件管理模块
│   └── shared/                 # 共享模块
│       ├── redis/              # Redis 服务
│       └── minio/              # MinIO 服务
├── prisma/                     # Prisma 配置
│   ├── schema.prisma           # 数据库模型定义
│   └── migrations/             # 数据库迁移文件
├── docker-compose.yaml         # Docker Compose 配置
└── package.json
```

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- Docker Desktop (macOS/Windows) 或 Docker Engine (Linux)
- pnpm (推荐) 或 npm

```bash
docker --version
docker compose version
```

如果命令未找到，请确保：
- Docker Desktop 已启动（macOS/Windows）
- Docker 服务正在运行（Linux）
- 重启终端或重新加载 PATH 环境变量

### 安装依赖

```bash
pnpm install
```

### 环境配置

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/tp_edit?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=tp-edit

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# AI API Keys
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key

# 应用配置
PORT=3005
NODE_ENV=development
```

### 启动开发环境

使用提供的开发脚本（会自动启动 Docker 服务）：

```bash
chmod +x dev.sh
./dev.sh
```

或手动启动：

```bash
# 1. 启动 Docker 服务（PostgreSQL, Redis, MinIO）
# 注意：新版本 Docker 使用 "docker compose"，旧版本使用 "docker-compose"
docker compose up -d
# 或
docker-compose up -d

# 2. 运行数据库迁移
pnpm prisma:migrate

# 3. 生成 Prisma Client
pnpm prisma:generate

# 4. 启动开发服务器
pnpm start:dev
```


### 访问服务

- **API 服务**: http://localhost:3005/api
- **Swagger 文档**: http://localhost:3005/api
- **MinIO 控制台**: http://localhost:9001 (默认账号: minioadmin/minioadmin)

## 📖 API 文档

启动服务后，访问 http://localhost:3005/api 查看 Swagger API 文档。

### 主要 API 端点

#### AI 文本生成

```bash
# 获取可用的 AI 模型提供方
GET /api/ai/providers

# 获取指定提供方的模型列表
GET /api/ai/models?provider=openai

# 生成文本（非流式）
POST /api/ai/generate
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4o",
  "prompt": "请介绍一下人工智能",
  "system": "你是一个专业的技术顾问",
  "temperature": 0.7,
  "maxTokens": 1000,
  "stream": false
}

# 生成文本（流式 SSE）
POST /api/ai/generate
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4o",
  "prompt": "请介绍一下人工智能",
  "stream": true
}
```

#### 用户认证

```bash
# 用户注册
POST /api/auth/register

# 用户登录
POST /api/auth/login

# 刷新 Token
POST /api/auth/refresh
```

## 🔧 开发

### 代码格式化

```bash
# 使用 Biome 格式化代码
pnpm format
```

### 代码检查

```bash
# ESLint 检查
pnpm lint
```

### 数据库操作

```bash
# 创建迁移
pnpm prisma:migrate dev --name migration_name

# 应用迁移
pnpm prisma:migrate deploy

# 查看数据库
pnpm prisma studio
```

### 运行测试

```bash
# 单元测试
pnpm test

# 测试覆盖率
pnpm test:cov

# E2E 测试
pnpm test:e2e
```

## 🏗️ 构建与部署

### 构建生产版本

```bash
pnpm build
```

### 启动生产服务

```bash
pnpm start:prod
```

### Docker 部署

```bash
# 构建镜像
docker build -t tp-edit-nest .

# 运行容器
docker run -p 3005:3005 --env-file .env tp-edit-nest
```

详细部署说明请参考 [CENTOS_DEPLOY.md](./CENTOS_DEPLOY.md)

## 🧩 核心模块

### AI 模块

支持多种 AI 模型提供方，提供流式和非流式两种文本生成方式。

**支持的模型：**
- OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- DeepSeek: `deepseek-chat`, `deepseek-coder`
- Google Gemini: `gemini-3-pro`, `gemini-3-flash-preview`

**流式响应实现：**
- 使用 RxJS Observable 管理流式数据
- 基于 Server-Sent Events (SSE) 协议
- 支持客户端断开自动取消订阅

### 认证模块

- JWT Token 认证
- 支持本地密码登录
- 支持 OAuth 第三方登录（Google, GitHub 等）
- Token 刷新机制

### 文件模块

- 基于 MinIO 的对象存储
- 支持文件上传、下载、删除
- 文件元数据管理

### 用户模块

- 用户 CRUD 操作
- 用户信息管理
- 软删除支持

## 🔒 安全

- 使用 `class-validator` 进行请求参数验证
- JWT Token 认证
- 密码使用 bcrypt 加密
- CORS 配置
- 环境变量管理敏感信息

## 📝 环境变量说明

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ |
| `REDIS_HOST` | Redis 主机地址 | ✅ |
| `REDIS_PORT` | Redis 端口 | ✅ |
| `MINIO_ENDPOINT` | MinIO 服务地址 | ✅ |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | ✅ |
| `MINIO_SECRET_KEY` | MinIO 密钥 | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `OPENAI_API_KEY` | OpenAI API 密钥 | ⚠️ |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ⚠️ |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API 密钥 | ⚠️ |

⚠️ AI API 密钥根据使用的模型提供方选择配置

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

UNLICENSED

## 🔗 相关链接

- [NestJS 文档](https://docs.nestjs.com/)
- [Prisma 文档](https://www.prisma.io/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Swagger 文档](https://swagger.io/docs/)

