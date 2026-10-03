# ---- 1. build the React frontend ----
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# tailwind also scans the seed data for category gradient classes
COPY myapp/management/commands/seed.py /myapp/management/commands/seed.py
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /frontend/dist /app/frontend/dist
RUN chmod +x start.sh
EXPOSE 8000
CMD ["sh", "start.sh"]
