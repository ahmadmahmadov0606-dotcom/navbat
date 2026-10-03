from django.conf import settings
from django.http import JsonResponse
from django.utils import translation
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import exceptions
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import exception_handler


class Pagination(PageNumberPagination):
    page_size, page_size_query_param, max_page_size = 12, "page_size", 100


def lang_middleware(get_response):
    codes = {code for code, _name in settings.LANGUAGES}

    def middleware(request):
        lang = request.GET.get("lang")
        if lang in codes:
            translation.activate(lang)
            request.LANGUAGE_CODE = lang
        response = get_response(request)
        if lang in codes:
            response.headers["Content-Language"] = lang
        return response

    return middleware


FIELDS = {k: gettext_lazy(v) for k, v in {
    "username": "Username", "password": "Password", "phone": "Phone", "role": "Role", "category": "Category",
    "name": "Name", "address": "Address", "city": "City", "service": "Service", "start": "Start", "end": "End",
    "date": "Date", "weekday": "Weekday", "status": "Status", "price": "Price", "duration_min": "Duration",
    "rating": "Rating", "comment": "Comment", "booking": "Booking", "refresh": "Refresh token",
}.items()}


def handle_error(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, exceptions.ValidationError):
        detail = exc.detail if isinstance(exc.detail, dict) else {"non_field_errors": exc.detail}
        errors = {k: [str(m) for m in (v if isinstance(v, list) else [v])] for k, v in detail.items()}
        text = " ".join(f"{FIELDS[k]}: {m}" if k in FIELDS else m for k, msgs in errors.items() for m in msgs)
        response.data = {"detail": text or _("Invalid data."), "code": "invalid", "errors": errors}
    else:
        detail = getattr(exc, "detail", None) or _("Not found.")
        if isinstance(detail, dict):
            response.data = {"detail": str(detail.get("detail")), "code": str(detail.get("code", "error"))}
        else:
            response.data = {"detail": str(detail), "code": getattr(detail, "code", "not_found")}
    return response


def api_404(request, *args, **kwargs):
    return JsonResponse({"detail": _("Not found."), "code": "not_found"}, status=404)
