# TaskTaker – Production Deployment (single Hetzner VPS)

Production runs with Docker Compose using `docker-compose.prod.yml`.

## 1. Prepare environment

```bash
cp .env.production.example .env.production
# Fill in every CHANGE_ME_* value and real public URLs.
# Generate strong secrets with: openssl rand -hex 48
```

## 2. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Services:

| Service   | Container            | Host binding        | Public? |
| --------- | -------------------- | ------------------- | ------- |
| frontend  | tasktaker-frontend   | `127.0.0.1:3000`    | via reverse proxy |
| backend   | tasktaker-backend    | `127.0.0.1:4000`    | via reverse proxy |
| postgres  | tasktaker-postgres   | internal only       | no      |
| redis     | tasktaker-redis      | internal only       | no      |
| pgadmin   | tasktaker-pgadmin    | `127.0.0.1:5050`    | no      |

All ports are bound to `127.0.0.1`, so nothing is reachable from the internet
directly. Put NGINX/Caddy in front to terminate TLS for the frontend/backend.

## 3. Run database migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend \
  node ./node_modules/typeorm/cli.js migration:run -d ./dist/src/data-source.js
```

## 4. pgAdmin 4 (database admin UI)

pgAdmin is deliberately **not exposed publicly**. It listens only on
`127.0.0.1:5050` on the VPS and connects to PostgreSQL over the internal
Docker network.

Login credentials come from `.env.production`:

```
PGADMIN_DEFAULT_EMAIL=you@example.com
PGADMIN_DEFAULT_PASSWORD=a-strong-password
```

### Option A — SSH tunnel (recommended, no extra config)

From your local machine:

```bash
ssh -L 5050:127.0.0.1:5050 user@your-hetzner-vps
```

Then open http://localhost:5050 in your browser and log in.

When adding the PostgreSQL server inside pgAdmin, use the **Docker network
hostname**, not `localhost`:

- Host name/address: `postgres`
- Port: `5432`
- Username: value of `DATABASE_USER`
- Password: value of `DATABASE_PASSWORD`
- Maintenance database: value of `DATABASE_DB`

### Option B — behind NGINX later (optional)

If you prefer browser access over a subdomain instead of an SSH tunnel,
add a **protected** location to NGINX. pgAdmin still only listens on
`127.0.0.1:5050`, so NGINX proxies to it locally.

Protect it with HTTP Basic Auth (or IP allow-listing / VPN) so it is never
openly public:

```nginx
# /etc/nginx/sites-available/pgadmin.example.com
server {
    listen 443 ssl;
    server_name pgadmin.example.com;

    # ssl_certificate / ssl_certificate_key managed by certbot

    # Restrict access — Basic Auth (or use "allow <office-ip>; deny all;")
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Create the Basic Auth user:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

Then set pgAdmin to trust the proxy headers by adding to the service
environment if needed (`PGADMIN_CONFIG_X_FRAME_OPTIONS`, etc.). For an SSH
tunnel this is not required.

> Security note: never remove the `127.0.0.1:` binding from the pgAdmin port
> mapping. Exposing pgAdmin (or PostgreSQL) directly to the internet is not
> supported.
