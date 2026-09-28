# Cyberpunk TCG // Production Web Server Container

This folder contains everything needed to run **Cyberpunk TCG as a hosted web application** or containerized service on **Fedora, Ubuntu, or any remote Linux VPS / cloud server**.

---

## ⚡ Features
- **Ultra-Lightweight & Secure:** Built on minimal `python:3.11-slim`, running under a dedicated unprivileged user (`cptcg`).
- **Pre-Compiled Assets:** Pre-bundles the monolith HTML at container build time for sub-millisecond response times.
- **Dynamic Configuration:** Supports `$PORT` and `$HOST` environment variables (compatible with Render, Fly.io, Railway, and custom VPS setups).
- **Healthcheck & Telemetry:** Native `/health` JSON endpoint for Docker, Kubernetes, and reverse-proxy load balancers.

---

## 🚀 Quick Start: Running Locally

### Option 1: On Fedora / RHEL (Using Podman)
Podman is daemonless, rootless, and pre-installed on Fedora:
```bash
bash scripts/container/run_podman.sh
```
Or manually:
```bash
podman build -t cyberpunk-tcg-server -f scripts/container/Dockerfile .
podman run -d --name cptcg-web -p 8080:8080 cyberpunk-tcg-server
```
Visit: **`http://localhost:8080`**

---

### Option 2: On Ubuntu / Debian (Using Docker)
```bash
bash scripts/container/run_docker.sh
```
Or manually:
```bash
docker build -t cyberpunk-tcg-server -f scripts/container/Dockerfile .
docker run -d --name cptcg-web --restart unless-stopped -p 8080:8080 cyberpunk-tcg-server
```
Visit: **`http://localhost:8080`**

---

### Option 3: Docker Compose
From the repository root or inside `scripts/container/`:
```bash
docker compose -f scripts/container/docker-compose.yml up -d
```
To stop:
```bash
docker compose -f scripts/container/docker-compose.yml down
```

---

## 🌐 Putting It Online (Cloud VPS / Remote Server)

To deploy Cyberpunk TCG to a remote server (Ubuntu or Fedora VPS):

### 1. Copy project to your server
```bash
git clone <your-repo-url> /opt/cyberpunk-tcg
cd /opt/cyberpunk-tcg
```

### 2. Launch the container
```bash
docker compose -f server_container/docker-compose.yml up -d
# or: bash server_container/run_podman.sh
```

### 3. (Optional) Nginx Reverse Proxy with Free HTTPS (Let's Encrypt)
To connect your custom domain (e.g., `tcg.yourdomain.com`):

```nginx
# /etc/nginx/sites-available/cyberpunk-tcg.conf
server {
    server_name tcg.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and secure with Certbot:
```bash
# Ubuntu:
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tcg.yourdomain.com

# Fedora:
sudo dnf install certbot python3-certbot-nginx
sudo certbot --nginx -d tcg.yourdomain.com
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port the web server listens on. |
| `HOST` | `0.0.0.0` | Host IP binding. |
