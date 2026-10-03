from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .api import api_404


def dist(name, content_type, cache="no-cache"):
    def view(request):
        file = settings.FRONTEND_DIST / name
        if not file.exists():
            return HttpResponse("Frontend is not built: cd frontend && npm install && npm run build", status=503)
        response = FileResponse(open(file, "rb"), content_type=content_type)
        response["Cache-Control"] = cache
        if name == "sw.js":
            response["Service-Worker-Allowed"] = "/"
        return response
    return view


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("myapp.urls")),
    re_path(r"^api/", api_404),
    path("sw.js", dist("sw.js", "application/javascript")),
    path("manifest.webmanifest", dist("manifest.webmanifest", "application/manifest+json")),
    path("", dist("index.html", "text/html; charset=utf-8")),
    re_path(r"^partner/?$", dist("index.html", "text/html; charset=utf-8")),
]

if "debug_toolbar" in settings.INSTALLED_APPS:
    urlpatterns.insert(0, path("__debug__/", include("debug_toolbar.urls")))
