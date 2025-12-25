# CI/CD 自动部署配置指南

本指南将帮助你配置 GitHub Actions 自动部署到生产服务器。

## 📋 部署架构

```
开发者推送代码到 main 分支
    ↓
GitHub Actions 自动触发
    ↓
通过 SSH 连接到服务器
    ↓
拉取最新代码 (git pull)
    ↓
执行部署脚本 (deploy.sh)
    ↓
健康检查验证
    ↓
部署完成
```

## 🚀 快速开始

### 步骤 1: 准备服务器

#### 1.1 确保服务器已安装必要工具

```bash
# 检查 Docker
docker --version

# 检查 Docker Compose
docker compose version

# 检查 Git
git --version
```

#### 1.2 克隆项目到服务器

```bash
# 选择合适的目录（例如 /root 或 /opt）
cd /root

# 克隆仓库
git clone https://github.com/你的用户名/tp-edit-nest.git

# 进入目录
cd tp-edit-nest
```

#### 1.3 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写所有必需的环境变量
nano .env
```

必需的环境变量：
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

#### 1.4 测试手动部署

```bash
# 给脚本执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh

# 验证服务是否正常
curl http://localhost:3005/health
```

### 步骤 2: 配置 SSH 密钥

#### 2.1 生成 SSH 密钥对（在本地电脑执行）

```bash
# 生成专用于 GitHub Actions 的 SSH 密钥
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# 会生成两个文件：
# - ~/.ssh/github_deploy (私钥)
# - ~/.ssh/github_deploy.pub (公钥)
```

#### 2.2 将公钥添加到服务器

```bash
# 方法 1: 使用 ssh-copy-id（推荐）
ssh-copy-id -i ~/.ssh/github_deploy.pub root@你的服务器IP

# 方法 2: 手动添加
# 在服务器上执行：
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# 将公钥内容追加到 authorized_keys
echo "公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

#### 2.3 测试 SSH 连接

```bash
# 使用私钥连接服务器
ssh -i ~/.ssh/github_deploy root@你的服务器IP

# 如果能成功连接，说明配置正确
```

### 步骤 3: 配置 GitHub Secrets

#### 3.1 进入 GitHub 仓库设置

1. 打开你的 GitHub 仓库
2. 点击 **Settings**（设置）
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**（新建仓库密钥）

#### 3.2 添加以下 Secrets

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `SSH_HOST` | 服务器 IP 地址 | `123.45.67.89` |
| `SSH_PORT` | SSH 端口（通常是 22） | `22` |
| `SSH_USER` | SSH 登录用户名 | `root` |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 | 见下方说明 |
| `DEPLOY_PATH` | 服务器上项目的绝对路径 | `/root/tp-edit-nest` |

#### 3.3 获取 SSH 私钥内容

```bash
# 显示私钥内容
cat ~/.ssh/github_deploy

# 输出示例：
# -----BEGIN OPENSSH PRIVATE KEY-----
# b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
# ... (多行内容) ...
# -----END OPENSSH PRIVATE KEY-----
```

**完整复制**私钥内容（包括 BEGIN 和 END 行），粘贴到 GitHub Secret `SSH_PRIVATE_KEY` 中。

### 步骤 4: 测试自动部署

#### 4.1 提交并推送代码

```bash
# 添加所有新文件
git add .

# 提交
git commit -m "feat: 添加 CI/CD 自动部署配置"

# 推送到 main 分支
git push origin main
```

#### 4.2 查看部署进度

1. 打开 GitHub 仓库
2. 点击 **Actions** 标签页
3. 可以看到正在运行的工作流
4. 点击进入查看详细日志

#### 4.3 验证部署结果

```bash
# 在服务器上查看容器状态
docker ps

# 查看应用日志
docker logs tp_app_prod -f

# 测试 API
curl https://tp-api.rongwr.xyz/health
```

## 🎮 手动触发部署

除了自动部署，你也可以手动触发：

1. 进入 GitHub 仓库的 **Actions** 页面
2. 左侧选择 **Deploy to Production** 工作流
3. 点击右侧 **Run workflow** 按钮
4. 选择分支（通常是 main）
5. 点击 **Run workflow** 确认

## 📊 查看部署历史

在服务器上查看部署日志：

```bash
# 进入项目目录
cd /root/tp-edit-nest

# 查看部署历史
cat deployments.log
```

## 🔧 故障排除

### 问题 1: SSH 连接失败

**错误信息：** `Permission denied (publickey)`

**解决方法：**
```bash
# 1. 确认公钥已添加到服务器
ssh -i ~/.ssh/github_deploy root@服务器IP

# 2. 检查 authorized_keys 权限
chmod 600 ~/.ssh/authorized_keys

# 3. 检查私钥格式是否正确（GitHub Secret 中）
# 确保包含完整的 BEGIN 和 END 行
```

### 问题 2: 部署脚本执行失败

**错误信息：** `deploy.sh: Permission denied`

**解决方法：**
```bash
# 在服务器上给脚本添加执行权限
cd /root/tp-edit-nest
chmod +x deploy.sh
```

### 问题 3: 健康检查失败

**错误信息：** `Health check failed`

**解决方法：**
```bash
# 1. 查看应用日志
docker logs tp_app_prod --tail=100

# 2. 检查容器状态
docker ps -a

# 3. 手动测试健康检查
curl http://localhost:3005/health

# 4. 检查端口是否被占用
netstat -tunlp | grep 3005
```

### 问题 4: Docker 构建失败

**错误信息：** `ERROR: build failed`

**解决方法：**
```bash
# 1. 清理 Docker 缓存
docker system prune -a

# 2. 查看磁盘空间
df -h

# 3. 手动构建测试
docker compose -f docker-compose.prod.yaml build --no-cache
```

### 问题 5: 环境变量未生效

**错误信息：** `Environment variable not found`

**解决方法：**
```bash
# 1. 确认 .env 文件存在
ls -la .env

# 2. 检查 .env 文件内容
cat .env

# 3. 验证必需的环境变量
source .env
echo $POSTGRES_USER
echo $OPENAI_API_KEY
```

## 🔒 安全建议

### 1. SSH 密钥管理
- ✅ 使用专用密钥对用于 CI/CD
- ✅ 定期轮换密钥（建议每 6 个月）
- ✅ 不要在代码中存储私钥
- ✅ 使用 GitHub Secrets 保护敏感信息

### 2. 服务器安全
- ✅ 配置防火墙，只开放必要端口
- ✅ 使用非标准 SSH 端口（可选）
- ✅ 启用 fail2ban 防止暴力破解
- ✅ 定期更新系统和软件包

### 3. 环境变量安全
- ✅ `.env` 文件权限设为 600
- ✅ 不要提交 `.env` 到 Git
- ✅ API 密钥定期轮换
- ✅ 使用强密码（数据库、MinIO 等）

## 📚 常用命令

### 服务器端

```bash
# 进入项目目录
cd /root/tp-edit-nest

# 拉取最新代码
git pull origin main

# 手动部署
./deploy.sh

# 查看服务状态
docker compose -f docker-compose.prod.yaml ps

# 查看日志
docker compose -f docker-compose.prod.yaml logs -f app

# 重启服务
docker compose -f docker-compose.prod.yaml restart app

# 停止所有服务
docker compose -f docker-compose.prod.yaml down

# 查看资源使用
docker stats
```

### 本地开发

```bash
# 推送代码触发部署
git push origin main

# 查看部署状态
# 访问: https://github.com/你的用户名/tp-edit-nest/actions

# 测试 SSH 连接
ssh -i ~/.ssh/github_deploy root@服务器IP
```

## 📝 文件说明

| 文件 | 说明 |
|------|------|
| `.github/workflows/deploy.yml` | GitHub Actions 工作流配置 |
| `deploy.sh` | 主部署脚本 |
| `deployments.log` | 部署历史记录（自动生成） |

## 🎯 下一步

配置完成后，你可以：

1. ✅ 每次推送到 main 分支自动部署
2. ✅ 手动触发部署
3. ✅ 查看部署日志和历史
4. ✅ 监控服务健康状态

需要更高级的功能？可以考虑：
- 添加自动化测试（CI）
- 配置蓝绿部署
- 添加部署通知（钉钉、邮件等）
- 实现自动回滚机制

---

**部署愉快！🚀**

如有问题，请查看 [故障排除](#故障排除) 部分或查看 GitHub Actions 日志。
