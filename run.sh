#!/bin/sh
# Local development: ./run.sh [port]   (default 8000)
set -e
PORT=${1:-8000}
[ -d venv ] || python3 -m venv venv
. venv/bin/activate
pip install -q -r requirements-dev.txt
[ -f .env ] || cp .env.example .env
if [ ! -f frontend/dist/index.html ]; then
  (cd frontend && npm install --no-audit --no-fund && npm run build)
fi
python manage.py migrate
python manage.py seed
python manage.py runserver 0.0.0.0:$PORT
