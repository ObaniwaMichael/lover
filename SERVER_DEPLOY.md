# Deploy to your cloud server (Oracle Linux / Ubuntu VM)

This guide assumes one VM runs **nginx** (HTTPS + static files) and **Node** (API + Socket.IO on port 4000). Same origin = simplest: leave `VITE_API_BASE_URL` unset when you build.

## 1. Open the network (Oracle Cloud)

In **VCN → Security Lists** (or NSG on the instance):

- Allow **TCP 22** from your IP (SSH).
- Allow **TCP 80** and **TCP 443** from `0.0.0.0/0` (or stricter) for the public web.

You do **not** need to expose port 4000 publicly if nginx proxies to `127.0.0.1:4000`.

## 2. Server packages

```sh
sudo dnf install -y git nginx   # Oracle Linux 8/9
# or: sudo apt update && sudo apt install -y git nginx   # Ubuntu
```

Install **Node.js 18+** ([NodeSource](https://github.com/nodesource/distributions) or your distro’s module).

Optional process manager:

```sh
sudo npm install -g pm2
```

## 3. Put the code on the server

**Option A — Git (recommended for updates)**

```sh
sudo mkdir -p /var/www && sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone <YOUR_REPO_URL> lover
cd lover
```

**Option B — Copy from your PC (no Git on server)**

From your machine (PowerShell example; adjust paths and `user@IP`):

```powershell
scp -r "C:\Users\you\...\lover" user@YOUR_SERVER_IP:/var/www/lover
```

Later updates: use Git on the server (`git pull`) or run `scp`/`rsync` again.

## 4. Backend environment

```sh
cd /var/www/lover/backend
cp .env.example .env
nano .env   # or vim
```

Set at least:

| Variable | Example |
|----------|---------|
| `JWT_SECRET` | Long random string |
| `GEMINI_API_KEY` | Your Gemini key |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `4000` |
| `CORS_ORIGIN` | `https://your-domain.com` (exact SPA origin, no trailing slash mismatch) |

Add `DATABASE_URL` if you use PostgreSQL; otherwise SQLite is used under `backend/data/`.

```sh
npm install
```

Test once:

```sh
node server.js
# Ctrl+C after /health works
```

Run under **pm2** (survives logout, restarts on reboot with `pm2 startup`):

```sh
cd /var/www/lover
pm2 start backend/server.js --name lover-api
pm2 save
```

## 5. Frontend build

```sh
cd /var/www/lover
npm install
```

If the SPA is served **from the same host** as the API (via nginx), you usually **do not** set `VITE_API_BASE_URL`. Copy root env template if needed:

```sh
cp .env.example .env
# Leave VITE_API_BASE_URL and VITE_SOCKET_URL empty for same-origin
```

Build:

```sh
npm run build
```

Output is in `dist/`.

## 6. nginx (static site + API + WebSockets)

Create `/etc/nginx/conf.d/lover.conf` (or a `sites-available` snippet) — replace `your-domain.com` and paths:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/lover/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Test and reload:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Use **Let’s Encrypt** (`certbot --nginx`) or your CA for HTTPS, then set `CORS_ORIGIN` to `https://your-domain.com`.

## 7. After you change code (updates)

```sh
cd /var/www/lover
git pull                    # or re-copy files
npm install
npm run build
cd backend && npm install
pm2 restart lover-api       # or your process name
sudo nginx -t && sudo systemctl reload nginx   # only if nginx config changed
```

## 8. If API and SPA are on different hosts

On the machine where you **build** the frontend, set in `.env` before `npm run build`:

```env
VITE_API_BASE_URL=https://api.your-domain.com
VITE_SOCKET_URL=https://api.your-domain.com
```

Backend `CORS_ORIGIN` must be the **SPA** origin (e.g. `https://app.your-domain.com`).

---

**Summary:** Push or copy the repo to the VM, configure `backend/.env`, run the API with pm2, build the SPA, point nginx at `dist/` and proxy `/api` + `/socket.io` to Node. Updates = pull, `npm install`, `npm run build`, restart pm2.
