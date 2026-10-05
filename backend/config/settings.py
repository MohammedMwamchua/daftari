"""Daftari settings. PostgreSQL by default; set USE_SQLITE=1 for a quick local run without Postgres."""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# Off unless asked for: a forgotten setting must never put debug pages in front of the public.
DEBUG = os.environ.get('DEBUG', '0') == '1'
SECRET_KEY = os.environ.get('SECRET_KEY') or ('dev-only-insecure-key-change-me-in-production-0123456789' if DEBUG else '')
# Sign-in tokens are signed with this key, so anyone who knows it could sign in as the manager.
WEAK_SECRET_KEY = len(SECRET_KEY) < 32 or SECRET_KEY.startswith('dev-only') or SECRET_KEY == 'change-me'
if not DEBUG and WEAK_SECRET_KEY:
    raise RuntimeError('Set SECRET_KEY to a long random value (at least 32 characters) when DEBUG=0.')
ALLOWED_HOSTS = [h for h in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h]
# Render sets this to the service's public hostname.
if render_host := os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(render_host)
    CSRF_TRUSTED_ORIGINS = [f'https://{render_host}']

# Public demo (Dockerfile + render.yaml): Django also serves the built frontend
# from FRONTEND_DIST, and DEMO_MODE stops visitors changing the shared password.
DEMO_MODE = os.environ.get('DEMO_MODE') == '1'
FRONTEND_DIST = os.environ.get('FRONTEND_DIST', '')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',  # no other site may show these pages in a frame
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

if os.environ.get('USE_SQLITE') == '1':
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
else:
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'daftari'),
        'USER': os.environ.get('POSTGRES_USER', 'daftari'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'daftari'),
        'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        # keep each connection open between requests instead of reconnecting every time
        'CONN_MAX_AGE': int(os.environ.get('CONN_MAX_AGE', '60')),
        'CONN_HEALTH_CHECKS': True,
    }}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
]

LANGUAGE_CODE = 'en'
TIME_ZONE = 'Africa/Dar_es_Salaam'
USE_I18N = False
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
if FRONTEND_DIST:
    WHITENOISE_ROOT = FRONTEND_DIST
    # Vite names every file in assets/ after a hash of its content, so browsers may keep them for good
    WHITENOISE_IMMUTABLE_FILE_TEST = r'^/assets/'
    from config.csp import add_headers as WHITENOISE_ADD_HEADERS_FUNCTION  # noqa: E402,N812
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# Where `manage.py backup_db` writes dated copies of the SQLite database.
BACKUP_DIR = Path(os.environ.get('BACKUP_DIR') or BASE_DIR.parent / 'backups')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['core.authentication.Authentication'],
    # How many proxies sit in front of Django and add the visitor's address (the Vite dev server, Render): the spam
    # and login limits trust only that many entries of X-Forwarded-For, so a visitor cannot fake their address.
    'NUM_PROXIES': int(os.environ.get('TRUSTED_PROXIES', '0')),
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'EXCEPTION_HANDLER': 'core.errors.handler',
}

SIMPLE_JWT = {
    # short-lived access tokens, renewed in the background; each refresh token works once, and signing out ends it
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# Behind an HTTPS proxy (Render): trust its https marker, tell browsers to use https only, keep cookies off http.
if os.environ.get('HTTPS_ONLY') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True

CORS_ALLOWED_ORIGINS = [o for o in os.environ.get(
    'CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if o]
