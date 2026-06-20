# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# WeasyPrint system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0 \
    libffi-dev libxml2 libxslt1.1 shared-mime-info fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /app/backend/static ./static

RUN mkdir -p uploads exports data

EXPOSE 8000
ENV DATABASE_URL=sqlite:///./data/templates.sqlite
ENV UPLOAD_DIR=uploads
ENV EXPORT_DIR=exports
ENV STATIC_DIR=static
ENV ALLOWED_ORIGINS=http://localhost:8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
