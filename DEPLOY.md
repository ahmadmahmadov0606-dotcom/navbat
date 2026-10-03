# Deploy

## Docker (recommended)

```bash
cp .env.example .env
# edit .env: SECRET_KEY (long random), DEBUG=0, ALLOWED_HOSTS=navbat.example.tj,
#            CSRF_TRUSTED_ORIGINS=https://navbat.example.tj
export DB_PASSWORD='a-strong-password'
docker compose up -d --build        # PostgreSQL + Redis + web (the image builds the React app itself)
docker compose exec web python manage.py seed          # optional demo data (tg / ru / en)
docker compose exec web python manage.py createsuperuser
```

`start.sh` runs `migrate` and `collectstatic` on every start, then gunicorn (`WEB_CONCURRENCY`, default 3 workers).
With `DEBUG=0` the app refuses to start without a real `SECRET_KEY`.

The app listens on port 8000. Put nginx in front (`/etc/nginx/sites-available/navbat`):

```nginx
server {
    listen 80;
    server_name navbat.example.tj;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

and enable HTTPS:

```bash
sudo ln -s /etc/nginx/sites-available/navbat /etc/nginx/sites-enabled/
sudo certbot --nginx -d navbat.example.tj
```

After HTTPS works you can set `SECURE_SSL_REDIRECT=1` and `SECURE_HSTS_SECONDS=31536000` in `.env`.

## Update

```bash
git pull
docker compose up -d --build
```

## Without Docker

```bash
python3 -m venv venv && . venv/bin/activate
pip install -r requirements.txt
(cd frontend && npm ci && npm run build)     # -> frontend/dist
sh start.sh
```

Set `REDIS_URL` if you run more than one gunicorn worker (shared cache for the catalog and for login throttling).

## Before release

```bash
pip install -r requirements-dev.txt && pytest       # all tests must pass
```

## Translations

API messages: edit `locale/tg/LC_MESSAGES/django.po` or `locale/ru/...`, then `python manage.py compilemessages`
and commit both `.po` and `.mo`. Frontend texts: `frontend/src/i18n/*.json` (rebuild the frontend).
Data (categories, specialties, services) is edited in the admin in all three languages.

## Important

- In production set `DEBUG=0` and a long random `SECRET_KEY`.
- Change the demo passwords or do not run `seed` on the real server (`seed` creates `admin / admin12345`).
- CORS is open only in `DEBUG`. If the frontend is on another domain, list it in `CORS_ALLOWED_ORIGINS`.
