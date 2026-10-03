import hashlib
import math
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from django.conf import settings
from django.core.cache import cache
from django.db import connection, transaction
from django.db.models import Avg, Count, DurationField, Exists, ExpressionWrapper, F, OuterRef, Prefetch, Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import get_language
from django.utils.translation import gettext as _
from rest_framework import generics, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import CITY_CENTERS, Booking, Category, City, DayOff, Favorite, Provider, Review, Service, WorkingHours
from .serializers import BookingSerializer, CategorySerializer, FavoriteSerializer, ProviderMeSerializer, ProviderSerializer, ReviewSerializer
AllowAny, IsAuthenticated = permissions.AllowAny, permissions.IsAuthenticated
LANGS = ("tg", "ru", "en")
 

def make_slots(day, minutes, capacity, hours, bookings, days_off=()):
    if day in days_off:
        return []
    step, now, slots = timedelta(minutes=minutes), timezone.now(), []
    for start, end in sorted(hours):
        cur, end = timezone.make_aware(datetime.combine(day, start)), timezone.make_aware(datetime.combine(day, end))
        while cur + step <= end:
            if cur > now and sum(s < cur + step and e > cur for s, e in bookings) < capacity:
                slots.append(cur)
            cur += step
    return slots


def free_slots(provider, service, day, exclude=None):
    if provider.days_off.filter(date=day).exists():
        return []
    start = timezone.make_aware(datetime.combine(day, time.min))
    bookings = provider.bookings.filter(status__in=Booking.ACTIVE, start__lt=start + timedelta(days=1), end__gt=start)
    bookings = bookings.exclude(pk=getattr(exclude, "pk", None)).values_list("start", "end")
    hours = provider.hours.filter(weekday=day.weekday()).values_list("start", "end")
    return make_slots(day, service.duration_min, provider.capacity, hours, list(bookings))


def with_window(qs, day, days=7):
    start = timezone.make_aware(datetime.combine(day, time.min))
    return qs.prefetch_related(
        Prefetch("services", Service.objects.filter(is_active=True), to_attr="active_services"),
        Prefetch("hours", WorkingHours.objects.all(), to_attr="all_hours"),
        Prefetch("days_off", DayOff.objects.filter(date__gte=day, date__lt=day + timedelta(days=days)), to_attr="window_off"),
        Prefetch("bookings", Booking.objects.filter(status__in=Booking.ACTIVE, start__lt=start + timedelta(days=days),
                                                    end__gt=start), to_attr="window_bookings"))


def next_slots(p, day, days=7, limit=3):
    if not p.active_services:
        return []
    hours, found = defaultdict(list), []
    for h in p.all_hours:
        hours[h.weekday].append((h.start, h.end))
    off, booked = {d.date for d in p.window_off}, [(b.start, b.end) for b in p.window_bookings]
    for d in (day + timedelta(days=i) for i in range(days)):
        found += make_slots(d, p.active_services[0].duration_min, p.capacity, hours[d.weekday()], booked, off)
        if len(found) >= limit:
            break
    return found[:limit]


class IsProvider(permissions.BasePermission):
    message = _("Only providers can do this. Register as a provider first.")

    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, "provider")


def cached(request, build, timeout=None):
    key = hashlib.md5(f"{cache.get_or_set('catalog:version', 1, None)}|{get_language()}|{request.build_absolute_uri()}".encode()).hexdigest()
    if (data := cache.get(key)) is None:
        cache.set(key, data := build(), timeout or settings.CATALOG_CACHE_SECONDS)
    return data


def parse_date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({"date": _("Enter a date in the format YYYY-MM-DD.")})


def ics(bookings, name="Navbat"):
    utc = lambda d: d.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Navbat//EN", f"X-WR-CALNAME:{name}"]
    for b in bookings:
        lines += ["BEGIN:VEVENT", f"UID:booking-{b.id}@navbat", f"DTSTAMP:{utc(b.updated_at)}", f"DTSTART:{utc(b.start)}",
                  f"DTEND:{utc(b.end)}", f"SUMMARY:{b.service.name} — {b.provider.name} — {b.customer.username}",
                  f"LOCATION:{b.provider.address}", "END:VEVENT"]
    return HttpResponse("\r\n".join(lines + ["END:VCALENDAR", ""]), content_type="text/calendar; charset=utf-8")


class CategoryList(generics.ListAPIView):
    queryset = Category.objects.annotate(providers_count=Count("providers"))
    serializer_class, permission_classes, pagination_class = CategorySerializer, [AllowAny], None

    def list(self, request, *args, **kwargs):
        return Response(cached(request, lambda: super(CategoryList, self).list(request).data))


class ProviderMixin:
    serializer_class, permission_classes = ProviderSerializer, [AllowAny]

    def get_queryset(self):
        p = self.request.query_params
        self.day = max(parse_date(p["date"]), timezone.localdate()) if p.get("date") else timezone.localdate()
        try:
            self.origin = (float(p["lat"]), float(p["lng"])) if p.get("lat") and p.get("lng") else None
        except ValueError:
            raise ValidationError({"lat": _("Invalid coordinates.")})
        return with_window(Provider.objects.select_related("category"), self.day)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "slots": getattr(self, "slots", {})}

    def km(self, p):
        (lat1, lng1), (lat2, lng2) = self.origin, (p.lat, p.lng) if p.lat is not None else CITY_CENTERS[p.city]
        a = math.sin(math.radians(lat2 - lat1) / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(
            math.radians(lat2)) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
        return round(12742 * math.asin(math.sqrt(a)), 1)

    def add_slots(self, providers):
        self.slots = {p.id: next_slots(p, self.day) for p in providers}
        for p in providers if self.origin else ():
            p.distance_km = self.km(p)
        return providers


class ProviderList(ProviderMixin, generics.ListAPIView):

    ORDER = {"distance": ("distance_km", "id"), "rating": ("-rating", "-reviews_count", "id")}

    def get_queryset(self):
        p, qs = self.request.query_params, super().get_queryset()
        qs = qs.filter(Exists(Service.objects.filter(provider=OuterRef("pk"), is_active=True)))
        if p.get("favorites"):
            if not self.request.user.is_authenticated:
                raise PermissionDenied(_("Sign in to see your saved specialists."))
            qs = qs.filter(favorited_by__user=self.request.user)
        if p.get("category"):
            qs = qs.filter(**{"category_id" if p["category"].isdigit() else "category__slug": p["category"]})
        if p.get("city"):
            if p["city"] not in City.values:
                raise ValidationError({"city": _("Unknown city.")})
            qs = qs.filter(city=p["city"])
        if q := p.get("search", "").strip()[:100]:
            cond, names = Q(), Q()
            for v in {q, q.lower(), q.capitalize()} if connection.vendor == "sqlite" else {q}:
                cond |= Q(name__icontains=v)
                for lang in LANGS:
                    cond |= Q(**{f"specialty_{lang}__icontains": v}) | Q(**{f"category__name_{lang}__icontains": v})
                    names |= Q(**{f"name_{lang}__icontains": v})
            qs = qs.filter(cond | Q(id__in=Service.objects.filter(names, is_active=True).values("provider_id")))
        if p.get("ordering") == "distance" and self.origin:
            return sorted(qs, key=lambda x: (self.km(x), x.id))
        if order := self.ORDER.get(p.get("ordering")):
            return qs.order_by(*order)
        first = {x.id: next_slots(x, self.day, limit=1) for x in qs}
        return sorted(qs, key=lambda x: (first[x.id][0] if first[x.id] else timezone.now() + timedelta(days=999), -x.rating, x.id))

    def paginate_queryset(self, queryset):
        return self.add_slots(super().paginate_queryset(queryset))

    def list(self, request, *args, **kwargs):
        build = lambda: super(ProviderList, self).list(request).data
        return Response(build() if request.query_params.get("favorites") else cached(request, build))


class ProviderDetail(ProviderMixin, generics.RetrieveAPIView):
    def get_object(self):
        return self.add_slots([super().get_object()])[0]


class ProviderSlots(ProviderMixin, generics.RetrieveAPIView):

    def retrieve(self, request, *args, **kwargs):
        provider, sid = self.get_object(), request.query_params.get("service")
        service = next((s for s in provider.active_services if not sid or str(s.id) == sid), None)
        if not service:
            raise ValidationError({"service": _("This provider has no such service.") if sid else _("This provider has no services yet.")})
        day = parse_date(request.query_params.get("date") or str(timezone.localdate()))
        return Response({"date": day, "service": service.id, "slots": [timezone.localtime(s) for s in free_slots(provider, service, day)]})


class ProviderMe(generics.RetrieveUpdateAPIView):

    serializer_class, permission_classes = ProviderMeSerializer, [IsProvider]

    def get_object(self):
        return Provider.objects.select_related("category").get(user=self.request.user)

    def post(self, request):
        Provider.objects.filter(user=request.user).update(calendar_token=uuid.uuid4())
        return self.retrieve(request)


class Own:

    permission_classes, pagination_class = [IsProvider], None

    def get_queryset(self):
        return self.serializer_class.Meta.model.objects.filter(provider__user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user.provider)

    def perform_destroy(self, obj):
        if isinstance(obj, Service) and obj.bookings.exists():
            Service.objects.filter(pk=obj.pk).update(is_active=False)
        else:
            obj.delete()


class OwnList(Own, generics.ListCreateAPIView):
    pass


class OwnDetail(Own, generics.RetrieveUpdateDestroyAPIView):
    pass


def book(booking, start):
    end = start + timedelta(minutes=booking.service.duration_min)
    with transaction.atomic():
        provider = Provider.objects.select_for_update().get(pk=booking.provider_id)
        mine = Booking.objects.filter(customer=booking.customer, status__in=Booking.ACTIVE, start__lt=end, end__gt=start)
        if mine.exclude(pk=booking.pk).exists():
            raise ValidationError({"start": _("You already have another booking at this time.")})
        if start not in free_slots(provider, booking.service, timezone.localtime(start).date(), exclude=booking):
            raise ValidationError({"start": _("This time is not available. Please choose another slot.")})
        booking.start, booking.end, booking.status, booking.confirmed_at = start, end, Booking.Status.PENDING, None
        booking.save()
    return booking


class BookingList(generics.ListCreateAPIView):

    serializer_class, permission_classes = BookingSerializer, [IsAuthenticated]

    def get_queryset(self):
        user, p = self.request.user, self.request.query_params
        qs = Booking.objects.select_related("provider", "service", "customer", "review")
        if p.get("as") == "provider":
            if not hasattr(user, "provider"):
                raise PermissionDenied(_("Only providers can see bookings made to them."))
            qs = qs.filter(provider=user.provider)
        else:
            qs = qs.filter(customer=user)
        if p.get("status"):
            if not set(p["status"].split(",")) <= set(Booking.Status.values):
                raise ValidationError({"status": _("Unknown status.")})
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("date"):
            start = timezone.make_aware(datetime.combine(parse_date(p["date"]), time.min))
            qs = qs.filter(start__gte=start, start__lt=start + timedelta(days=1))
        if p.get("upcoming"):
            qs = qs.filter(end__gt=timezone.now())
        return qs.order_by(p["ordering"], "id") if p.get("ordering") in ("start", "-start", "-updated_at") else qs

    def perform_create(self, serializer):
        service = serializer.validated_data["service"]
        serializer.instance = book(Booking(service=service, provider=service.provider, customer=self.request.user),
                                   serializer.validated_data["start"])


class BookingDetail(generics.RetrieveAPIView):
    serializer_class, permission_classes = BookingSerializer, [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        return Booking.objects.select_related("provider", "service", "customer").filter(Q(customer=u) | Q(provider__user=u))


class BookingStatus(BookingDetail):

    def post(self, request, pk):
        b = self.get_object()
        new = serializers.ChoiceField(Booking.Status.choices).run_validation(request.data.get("status"))
        if b.provider.user_id != request.user.id and new != Booking.Status.CANCELLED:
            raise ValidationError({"status": _("You can only cancel your booking.")})
        if b.provider.user_id != request.user.id and b.status not in Booking.ACTIVE:
            raise ValidationError({"status": _("Only pending or confirmed bookings can be cancelled.")})
        b.status = new
        b.confirmed_at = b.confirmed_at or (timezone.now() if new == Booking.Status.CONFIRMED else None)
        b.save()
        return Response(self.get_serializer(b).data)


class BookingReschedule(BookingDetail):

    def post(self, request, pk):
        b = get_object_or_404(self.get_queryset(), pk=pk, customer=request.user)
        if b.status not in Booking.ACTIVE:
            raise ValidationError({"status": _("Only pending or confirmed bookings can be moved.")})
        start = serializers.DateTimeField().run_validation(request.data.get("start"))
        if start <= timezone.now():
            raise ValidationError({"start": _("You cannot book a time in the past.")})
        return Response(self.get_serializer(book(b, start)).data)


class BookingIcs(BookingDetail):
    def get(self, request, pk):
        response = ics([self.get_object()])
        response["Content-Disposition"] = f'attachment; filename="navbat-{pk}.ics"'
        return response


class ReviewList(generics.ListCreateAPIView):

    serializer_class, permission_classes = ReviewSerializer, [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        pid = str(self.kwargs.get("pk") or self.request.query_params.get("provider", ""))
        qs = Review.objects.select_related("booking__customer", "booking__service")
        return qs.filter(booking__provider_id=pid) if pid.isdigit() else qs


class FavoriteList(generics.GenericAPIView):

    serializer_class, permission_classes = FavoriteSerializer, [IsAuthenticated]

    def get(self, request):
        return Response(request.user.favorites.values_list("provider_id", flat=True))

    def post(self, request):
        pid = request.data.get("provider")
        if not str(pid).isdigit() or not Provider.objects.filter(pk=pid).exists():
            raise ValidationError({"provider": _("Invalid id.")})
        created = Favorite.objects.get_or_create(user=request.user, provider_id=pid)[1]
        return Response({"provider": int(pid)}, status=201 if created else 200)

    def delete(self, request, pk):
        request.user.favorites.filter(provider_id=pk).delete()
        return Response(status=204)


@extend_schema(responses=dict)
@api_view()
@permission_classes([AllowAny])
def cities(request):
    return Response([{"id": c.value, "name": c.label} for c in City])


@extend_schema(responses=dict)
@api_view()
@permission_classes([AllowAny])
def stats(request):
    city = request.query_params.get("city")
    if city and city not in City.values:
        raise ValidationError({"city": _("Unknown city.")})

    def build():
        now, month, where = timezone.now(), timezone.now() - timedelta(days=30), {"city": city} if city else {}
        agg = Booking.objects.filter(**{f"provider__{k}": v for k, v in where.items()}).aggregate(
            week=Count("id", filter=Q(created_at__gte=now - timedelta(days=7))),
            done=Count("id", filter=Q(status="done", start__gte=month)),
            finished=Count("id", filter=Q(status__in=["done", "cancelled"], start__gte=month)),
            confirm=Avg(ExpressionWrapper(F("confirmed_at") - F("created_at"), output_field=DurationField())))
        providers = with_window(Provider.objects.filter(services__is_active=True, **where).distinct(), timezone.localdate(), 1)
        return {"bookings_week": agg["week"], "providers": len(providers),
                "free_today": sum(bool(next_slots(p, timezone.localdate(), 1, 1)) for p in providers),
                "completion_rate": round(100 * agg["done"] / agg["finished"]) if agg["finished"] else None,
                "avg_confirm_minutes": round(agg["confirm"].total_seconds() / 60, 1) if agg["confirm"] else None}
    return Response(cached(request, build, 60))


def calendar_feed(request, token):
    provider = get_object_or_404(Provider, calendar_token=token)
    qs = provider.bookings.filter(start__gte=timezone.now() - timedelta(days=30)).exclude(status="cancelled")
    return ics(qs.select_related("service", "customer", "provider").order_by("start")[:1000], f"Navbat — {provider.name}")
