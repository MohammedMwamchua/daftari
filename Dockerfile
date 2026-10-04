# Public demo image, used by render.yaml. It builds the React app, then runs
# Django, which serves both the API and the built screens from one address.

FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Shows the demo notice and fills in the demo login on the sign-in screen.
ENV VITE_DEMO=1
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/dist /app/frontend-dist

ENV DEBUG=0 \
    USE_SQLITE=1 \
    DEMO_MODE=1 \
    FRONTEND_DIST=/app/frontend-dist
RUN SECRET_KEY=collectstatic-only python manage.py collectstatic --noinput

# The disk is wiped on every restart, so each start creates a fresh database
# with three months of sample data. Visitors can't break the demo for long.
CMD python manage.py migrate --noinput \
    && python manage.py seed_demo --demo \
    && gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 2
