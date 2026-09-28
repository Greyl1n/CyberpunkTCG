# 📖 Cyberpunk TCG // Linux & Container Deployment Guide

Complete step-by-step instructions for building and running **Cyberpunk TCG** on **Fedora, Ubuntu, Debian**, and **cloud servers**.

---

## ⚡ Quick Comparison

| Feature | Option 1: Standalone Linux Desktop | Option 2: Production Web Container |
| :--- | :--- | :--- |
| **Location** | `scripts/linux/` | `scripts/container/` |
| **Output** | Single native executable (`Cyberpunk_TCG_Linux`) | Docker / Podman container image |
| **Target Use Case** | Personal desktop gameplay without containers | Local container or hosting online on a VPS |
| **Host Distros** | Fedora, Ubuntu, Debian, Arch Linux | Any system with Docker or Podman installed |
| **Dependencies** | Python 3 + WebKit (or default browser fallback) | Docker or Podman engine |

---

# 🖥️ Part 1: Standalone Linux Desktop App (`scripts/linux/`)

This option compiles a self-contained portable executable file (`dist/Cyberpunk_TCG_Linux`) containing the Python runtime, desktop window interface (`pywebview`), 151 card images, and audio engine.

---

### Step 1: Install System Prerequisites (One-time)

Open your terminal and install the development packages:

#### On **Fedora**:
```bash
sudo dnf install -y python3 python3-pip webkit2gtk4.0
```

#### On **Ubuntu / Debian**:
```bash
# Ubuntu 22.04:
sudo apt update && sudo apt install -y python3 python3-pip libwebkit2gtk-4.0-37

# Ubuntu 24.04+:
sudo apt update && sudo apt install -y python3 python3-pip libwebkit2gtk-4.1-0
```

> [!NOTE]
> If WebKit is absent on your system, the app will **not** crash—it automatically opens in your default web browser (Firefox, Chrome) pointing to the embedded server engine.

---

### Step 2: Build the Linux Executable

From the project root directory:

```bash
cd Cyberpunk_TCG
```

#### Option A: Direct Native Build (Fastest on Linux)
```bash
bash scripts/linux/build.sh
```
This automatically installs `pyinstaller` (if missing) and compiles `dist/Cyberpunk_TCG_Linux`.

#### Option B: Hermetic Container Build (No local Python setup required)
If you do not want to install build tools or pip packages on your host OS:
```bash
bash scripts/linux/build_with_container.sh
```
*This uses Podman (Fedora) or Docker (Ubuntu) to compile inside a clean Ubuntu 22.04 LTS container, ensuring universal `glibc` backward-compatibility across Fedora 38–41+, Ubuntu 22.04/24.04+, Debian 12+, and Arch.*

---

### Step 3: Run the Application

Launch it directly from the terminal:
```bash
./dist/Cyberpunk_TCG_Linux
```
Or double-click the file inside your desktop file manager (**Files / Nautilus**).

---

### Step 4: Install Application Menu Shortcut (GNOME / KDE)

To launch Cyberpunk TCG from your system search or application launcher:

```bash
bash scripts/linux/install_desktop_shortcut.sh
```

Now you can press the `Super` (Windows) key and search for **"Cyberpunk TCG"**.

---

---

# 🌐 Part 2: Production Web Container (`scripts/container/`)

Use this option to run the game as an isolated containerized service or to host it online on a remote VPS for multiplayer/community access.

---

### Step 1: Running Locally on Your Machine

Navigate to the project directory:
```bash
cd Cyberpunk_TCG
```

#### On **Fedora / RHEL** (Using Podman):
Podman is daemonless, rootless, and pre-installed on Fedora:
```bash
bash scripts/container/run_podman.sh
```

#### On **Ubuntu / Debian** (Using Docker):
```bash
bash scripts/container/run_docker.sh
```

#### Universal (Using Docker Compose):
```bash
docker compose -f scripts/container/docker-compose.yml up -d
```

Open your browser and visit:
👉 **`http://localhost:8080/`**

To stop the container:
```bash
# Podman:
podman stop cptcg-web

# Docker:
docker stop cptcg-web

# Docker Compose:
docker compose -f scripts/container/docker-compose.yml down
```

---

### Step 2: Deploying Online to a Cloud Server / VPS

When you are ready to put Cyberpunk TCG online on a cloud provider (e.g. DigitalOcean, Linode, Hetzner, AWS, Oracle Cloud):

#### 1. Clone repository on the server:
```bash
git clone <your-github-repo-url> /opt/cyberpunk-tcg
cd /opt/cyberpunk-tcg
```

#### 2. Start the container in background mode:
```bash
docker compose -f scripts/container/docker-compose.yml up -d
# (or with Podman: bash scripts/container/run_podman.sh)
```
The application is now accessible at `http://YOUR_SERVER_IP:8080`.

---

### Step 3: Connect a Custom Domain with Free HTTPS (SSL)

To serve your game on a clean URL like `https://tcg.yourdomain.com`:

1. **DNS Setup:** Add an **A record** in your domain registrar pointing `tcg.yourdomain.com` to your server's public IP.

2. **Install Nginx:**
   - **On Ubuntu:**
     ```bash
     sudo apt update && sudo apt install -y nginx
     ```
   - **On Fedora:**
     ```bash
     sudo dnf install -y nginx && sudo systemctl enable --now nginx
     ```

3. **Configure Reverse Proxy:**
   Create `/etc/nginx/conf.d/cyberpunk_tcg.conf`:
   ```nginx
   server {
       listen 80;
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

4. **Test & Reload Nginx:**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Generate Free SSL Certificate with Let's Encrypt (Certbot):**
   ```bash
   # Ubuntu:
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d tcg.yourdomain.com

   # Fedora:
   sudo dnf install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d tcg.yourdomain.com
   ```

Certbot automatically configures HTTPS encryption and automatic SSL renewal.

---

### Step 4: Healthcheck & Telemetry

The container includes a dedicated healthcheck endpoint:
- **URL:** `http://localhost:8080/health`
- **Output:** `{"status":"healthy","service":"cyberpunk_tcg"}`

View live container logs:
```bash
podman logs -f cptcg-web
# or
docker logs -f cptcg-web
```

---

## 🛠️ Summary of Scripts

| Script | Purpose |
| :--- | :--- |
| `scripts/linux/build.sh` | Builds native Linux desktop executable on Ubuntu/Fedora. |
| `scripts/linux/build_with_container.sh` | Compiles executable inside an isolated Ubuntu 22.04 container. |
| `scripts/linux/install_desktop_shortcut.sh` | Installs launcher icon into GNOME/KDE application menus. |
| `scripts/container/run_podman.sh` | Launches production container server with Podman (Fedora default). |
| `scripts/container/run_docker.sh` | Launches production container server with Docker (Ubuntu default). |
| `scripts/container/docker-compose.yml` | 1-command Docker Compose orchestration. |
