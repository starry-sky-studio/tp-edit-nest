# CentOS/RHEL 服务器部署指南

## 📋 服务器信息

- **IP 地址**: `68.64.177.105`
- **系统**: CentOS/RHEL（使用 yum/dnf）
- **内存**: 1GB
- **CPU**: 1 核心

## 🔧 CentOS/RHEL 专用命令

### 检查 Docker 是否已安装

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 是否已安装
docker-compose --version
```

如果 Docker 已安装，可以跳过安装步骤。

### 安装 Git

```bash
# CentOS 7 使用 yum
yum install -y git

# CentOS 8+ 使用 dnf
dnf install -y git
```

### 安装 Docker Compose（如果未安装）

```bash
# 下载 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

## 🚀 完整部署步骤（CentOS 版本）

### 1. 检查并安装必要软件

```bash
# 检查 Docker（如果已安装可以跳过）
docker --version

# 安装 Git
yum install -y git  # CentOS 7
# 或
dnf install -y git  # CentOS 8+

# 安装 Docker Compose（如果未安装）
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 2. 上传项目代码

```bash
# 方式1: 使用 Git
cd /opt
git clone <your-repo-url> tp-edit-nest
cd tp-edit-nest

# 方式2: 使用 scp（在本地电脑执行）
# scp -r tp-edit-nest root@68.64.177.105:/opt/
```

### 3. 配置环境变量

```bash
cd /opt/tp-edit-nest
cp .env.example .env
vi .env  # 或使用 nano（如果已安装）
```

### 4. 部署应用

```bash
# 给脚本添加执行权限
chmod +x deploy.sh

# 运行部署脚本（以 root 运行会自动配置 Nginx）
sudo ./deploy.sh
```

## 📝 CentOS 常用命令对照表

| Debian/Ubuntu | CentOS/RHEL |
|--------------|-------------|
| `apt update` | `yum update` 或 `dnf update` |
| `apt install` | `yum install` 或 `dnf install` |
| `apt upgrade` | `yum upgrade` 或 `dnf upgrade` |
| `systemctl` | `systemctl` (相同) |
| `service` | `service` (相同) |

## 🔍 系统信息检查

```bash
# 查看系统版本
cat /etc/redhat-release
# 或
cat /etc/os-release

# 查看内存
free -h

# 查看磁盘空间
df -h
```

## ⚠️ 注意事项

1. **防火墙**: CentOS 使用 `firewalld` 或 `iptables`
   ```bash
   # 检查防火墙状态
   systemctl status firewalld

   # 如果需要开放端口
   firewall-cmd --permanent --add-port=80/tcp
   firewall-cmd --permanent --add-port=443/tcp
   firewall-cmd --reload
   ```

2. **SELinux**: 可能需要配置 SELinux
   ```bash
   # 查看 SELinux 状态
   getenforce

   # 如果遇到权限问题，可以临时禁用（不推荐）
   # setenforce 0
   ```

3. **Swap 空间**: 1GB 内存建议添加 Swap
   ```bash
   # 创建 1GB Swap
   fallocate -l 1G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile

   # 永久启用
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

## 🐛 常见问题

### Docker 服务未启动

```bash
# 启动 Docker 服务
systemctl start docker
systemctl enable docker

# 检查状态
systemctl status docker
```

### 权限问题

```bash
# 如果 Docker 命令需要 sudo，可以添加用户到 docker 组
usermod -aG docker $USER
newgrp docker
```

