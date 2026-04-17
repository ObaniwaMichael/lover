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

### PostgreSQL (if you want Postgres instead of SQLite)

Keep Postgres **localhost-only**: do **not** add TCP **5432** to your cloud firewall; the Node app connects to `127.0.0.1`.

**Oracle Linux 8/9**

```sh
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

**Ubuntu**

```sh
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create a database and user (pick a strong password; use only safe characters or percent-encode the password in `DATABASE_URL`):

```sh
sudo -u postgres psql -c "CREATE USER lover_app WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE lover OWNER lover_app;"
```

Allow password auth from the loopback interface (needed for `postgres://...@127.0.0.1:5432/...`). Edit `pg_hba.conf` (path varies, e.g. `/var/lib/pgsql/data/pg_hba.conf` on Oracle Linux, `/etc/postgresql/*/main/pg_hba.conf` on Ubuntu) and ensure a line like:

```
host    all    all    127.0.0.1/32    scram-sha-256
```

Then:

```sh
# Oracle Linux example — adjust path if `sudo -u postgres psql -c 'SHOW hba_file;'` differs
sudo systemctl restart postgresql
# Ubuntu: sudo systemctl restart postgresql
```

In `backend/.env` set:

```env
DATABASE_URL=postgres://lover_app:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/lover
```

The app creates tables on startup. If the connection fails, Node falls back to SQLite (check logs).

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
| `CORS_ORIGIN` | **Must match the URL users open in the browser**, e.g. `https://loverscode.duckdns.org` (no trailing slash). After HTTPS, use `https://`, not `http://`. |
| `TRUST_PROXY` | Set to `1` when **nginx** sits in front of Node (recommended) so rate limits and logs see the real client IP. |

**DuckDNS + this project:** Point `loverscode.duckdns.org` (your host) at your VM’s public IP (e.g. `102.88.108.231`). Wait for DNS, then use that hostname in `CORS_ORIGIN` and nginx `server_name`.

Add `DATABASE_URL` if you use PostgreSQL (see **PostgreSQL** under step 2); omit it to use SQLite under `backend/data/`.

```sh
npm install
```

### Native module `better-sqlite3`

It must be compiled on the server. If `npm install` fails, install build tools on Oracle Linux: `sudo dnf install -y gcc gcc-c++ make python3`.

Test once:

```sh
node server.js
# Ctrl+C after curl -s localhost:4000/health
```

Run under **PM2** from the **`backend/`** folder so `cwd` and `node_modules` are correct (avoids wrong `express-rate-limit` / `better-sqlite3` resolution when the repo root also has a `package.json`):

```sh
cd /var/www/lover/backend
mkdir -p logs
pm2 delete lover-api 2>/dev/null   # only if an old misconfigured process exists
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u "$USER" --hp "$HOME"   # follow the line it prints
```

Do **not** rely on `pm2 start ../backend/server.js` from the repo root without setting `cwd` to `backend/`.

## 5. Frontend build

```sh
cd /var/www/lover
npm install
```

If the SPA is served **from the same host** as the API (via nginx), you usually **do not** set `VITE_API_BASE_URL`. Copy root env template if needed:

```sh
cp .env.example .env
# Same host as nginx: leave VITE_API_BASE_URL and VITE_SOCKET_URL empty.
# For invite / public links, set e.g. VITE_PUBLIC_APP_URL=https://loverscode.duckdns.org
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
    server_name loverscode.duckdns.org;
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

Use **Let’s Encrypt** (`certbot --nginx -d loverscode.duckdns.org`), then set **`CORS_ORIGIN=https://loverscode.duckdns.org`** in `backend/.env`, rebuild the frontend if you changed `VITE_*`, and **`pm2 restart lover-api`**.

## 7. After you change code (updates)

```sh
cd /var/www/lover
git pull                    # or re-copy files
npm install
npm run build
cd backend && npm install
pm2 restart lover-api
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

**Summary:** Push or copy the repo to the VM, configure `backend/.env`, run the API with PM2 **from `backend/`** (`ecosystem.config.cjs`), build the SPA, point nginx at `dist/` and proxy `/api` + `/socket.io` to Node. Updates = pull, `npm install` (root + backend), `npm run build`, `pm2 restart lover-api`.

---

## Troubleshooting (PM2 / `ERR_MODULE_NOT_FOUND` / `ipKeyGenerator`)

**`Cannot find package 'compression'` or `better-sqlite3'`**  
Dependencies must be installed **inside `backend/`** (that is where `package.json` for the API lives):

```bash
cd /path/to/lover/backend
npm install
pm2 restart lover-api
```

If it still fails, clean install:

```bash
cd /path/to/lover/backend
rm -rf node_modules
npm install
pm2 restart lover-api
```

**`does not provide an export named 'ipKeyGenerator'`**  
Your tree is an **old** `server.js`. Pull latest `main`, then reinstall as above. Current code uses a local `makeRateLimitKey()` and does not import `ipKeyGenerator`.

**`ECONNREFUSED 127.0.0.1:5432` / PostgreSQL unavailable**  
`DATABASE_URL` points at Postgres but nothing is listening. Either:

- **Use SQLite (simplest):** comment out or remove `DATABASE_URL` in `backend/.env`, restart PM2, or  
- **Run Postgres** for real and fix the URL/user/password.

**Wrong `NODE_ENV` / CORS in logs**  
Set `NODE_ENV=production` and `CORS_ORIGIN=https://loverscode.duckdns.org` (your real URL) in `backend/.env`, then `pm2 restart lover-api --update-env`.

---

## Round-up checklist (`loverscode.duckdns.org`)

1. **DuckDNS:** Host points to your VM IP; `ping loverscode.duckdns.org` returns that IP.  
2. **Firewall:** TCP **80**, **443**, **22** allowed as needed.  
3. **`backend/.env`:** `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=4000`, `CORS_ORIGIN=https://loverscode.duckdns.org`, `TRUST_PROXY=1`, secrets set; optional **`DATABASE_URL`** if you installed Postgres (step 2).  
4. **Backend deps:** `cd backend && npm install` (then PM2 as above).  
5. **Frontend:** Root `.env` with `VITE_PUBLIC_APP_URL=https://loverscode.duckdns.org` if the app needs a stable public URL; `npm run build`.  
6. **nginx:** `server_name` + TLS; `proxy_set_header X-Forwarded-Proto $scheme`.  
7. **Smoke test:** `curl -s https://loverscode.duckdns.org/health` and open the site in a browser; log in and hit one authenticated API.
