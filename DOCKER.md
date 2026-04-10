# Docker 部署指南

## 快速开始

### 1. 配置环境变量

复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件，至少修改：
- `ADMIN_KEY`: 管理员密钥（必须修改）

### 2. 构建并启动

```bash
docker-compose up -d
```

### 3. 查看日志

```bash
docker-compose logs -f
```

### 4. 停止服务

```bash
docker-compose down
```

## 数据持久化

数据库文件会挂载到宿主机：
- `./data` - 数据目录
- `./mimo-proxy.db` - SQLite 数据库文件

## 端口配置

默认端口是 8080，可以在 `docker-compose.yml` 中修改：
```yaml
ports:
  - "3000:8080"  # 宿主机端口:容器端口
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 仅使用 Docker（不用 docker-compose）

```bash
# 构建镜像
docker build -t mimo-proxy .

# 运行容器
docker run -d \
  --name mimo-proxy \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/mimo-proxy.db:/app/mimo-proxy.db \
  --env-file .env \
  mimo-proxy
```
