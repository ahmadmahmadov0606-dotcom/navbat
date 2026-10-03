import os
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
env = os.getenv
env_list = lambda name, default="": [x.strip() for x in env(name, default).split(",") if x.strip()]

DEBUG = env("DEBUG", "1") == "1"
SECRET_KEY = env("SECRET_KEY", "dev-secret-key-change-me")
if not DEBUG and SECRET_KEY.startswith(("dev-secret", "change-me")):
    raise RuntimeError("Set a long random SECRET_KEY in .env when DEBUG=0.")
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "*")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = DEBUG and not CORS_ALLOWED_ORIGINS
CORS_URLS_REGEX = r"^/api/.*$"

INSTALLED_APPS = [
    "modeltranslation",
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes", "django.contrib.sessions",
    "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "corsheaders", "drf_spectacular",
    "accounts", "myapp",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "core.api.lang_middleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True,
    "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth",
                                       "django.contrib.messages.context_processors.messages"]},
}]

if env("POSTGRES_DB"):
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql", "NAME": env("POSTGRES_DB"), "USER": env("POSTGRES_USER", "navbat"),
        "PASSWORD": env("POSTGRES_PASSWORD", ""), "HOST": env("POSTGRES_HOST", "localhost"), "PORT": env("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }}
else:
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.sqlite3", "NAME": env("SQLITE_PATH", BASE_DIR / "db.sqlite3"),
        "OPTIONS": {"transaction_mode": "IMMEDIATE", "timeout": 20}, "TEST": {"NAME": BASE_DIR / "test_db.sqlite3"},
    }}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": env("REDIS_URL")}
          if env("REDIS_URL") else {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CATALOG_CACHE_SECONDS = int(env("CATALOG_CACHE_SECONDS", "45"))
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "tg"
LANGUAGES = [("tg", "Тоҷикӣ"), ("ru", "Русский"), ("en", "English")]
LOCALE_PATHS = [BASE_DIR / "locale"]
MODELTRANSLATION_TRANSLATION_FILES = ("myapp.admin",)
MODELTRANSLATION_FALLBACK_LANGUAGES = ("tg", "ru", "en")
TIME_ZONE = "Asia/Dushanbe"
USE_I18N = USE_TZ = True

FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []
STORAGES = {"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
            "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"}}
WHITENOISE_MAX_AGE = 3600
WHITENOISE_IMMUTABLE_FILE_TEST = lambda path, url: "/assets/" in url

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_PAGINATION_CLASS": "core.api.Pagination",
    "EXCEPTION_HANDLER": "core.api.handle_error",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"] + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_THROTTLE_RATES": {"auth": env("AUTH_THROTTLE_RATE", "10/min")},
}
SPECTACULAR_SETTINGS = {
    "TITLE": "Navbat API", "VERSION": "1.0",
    "DESCRIPTION": "Login: POST /api/auth/login/ -> access token -> Authorize. Language: Accept-Language or ?lang=tg|ru|en.",
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
    "COMPONENT_SPLIT_REQUEST": True,
}
SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME": timedelta(hours=2), "REFRESH_TOKEN_LIFETIME": timedelta(days=30)}

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env("SECURE_SSL_REDIRECT", "0") == "1"
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "0"))
    SECURE_CONTENT_TYPE_NOSNIFF, SECURE_REFERRER_POLICY, X_FRAME_OPTIONS = True, "same-origin", "DENY"

if DEBUG and "pytest" not in sys.modules and env("DEBUG_TOOLBAR", "1") == "1":
    try:
        import debug_toolbar
        INSTALLED_APPS.append("debug_toolbar")
        MIDDLEWARE.insert(3, "debug_toolbar.middleware.DebugToolbarMiddleware")
        INTERNAL_IPS = ["127.0.0.1"]
    except ImportError:
        pass
