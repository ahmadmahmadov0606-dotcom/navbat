from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext
from rest_framework import serializers
from .models import Booking, Category, DayOff, Favorite, Provider, Review, Service, WorkingHours


class CategorySerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "icon", "gradient", "stats"]
    def get_stats(self, obj):
        n = getattr(obj, "providers_count", 0)
        return obj.stats_label or ngettext("%(n)d provider", "%(n)d providers", n) % {"n": n}

class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "provider", "name", "name_tg", "name_ru", "name_en", "duration_min", "price", "is_active"]
        read_only_fields = ["provider"]
        extra_kwargs = {"name": {"required": False}}

    def validate(self, data):
        if not self.instance and not any(data.get(f) for f in ("name", "name_tg", "name_ru", "name_en")):
            raise serializers.ValidationError({"name": _("Enter the name at least in one language.")})
        return data


class WorkingHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkingHours
        fields = ["id", "provider", "weekday", "start", "end"]
        read_only_fields = ["provider"]

    def validate(self, data):
        def get(field):
            return data.get(field, getattr(self.instance, field, None))

        if get("start") >= get("end"):
            raise serializers.ValidationError({"end": _("The end time must be later than the start time.")})
        same_day = WorkingHours.objects.filter(provider__user=self.context["request"].user, weekday=get("weekday"),
                                               start__lt=get("end"), end__gt=get("start"))
        if same_day.exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError({"start": _("These hours overlap with other working hours on the same day.")})
        return data


class DayOffSerializer(serializers.ModelSerializer):
    class Meta:
        model = DayOff
        fields = ["id", "provider", "date"]
        read_only_fields = ["provider"]

    def validate_date(self, value):
        if DayOff.objects.filter(provider__user=self.context["request"].user, date=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError(_("This day is already marked as a day off."))
        return value


class ProviderSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    initials = serializers.ReadOnlyField()
    services = serializers.SerializerMethodField()
    price_from = serializers.SerializerMethodField()
    main_service = serializers.SerializerMethodField()
    next_slots = serializers.SerializerMethodField()

    class Meta:
        model = Provider
        fields = ["id", "name", "specialty", "city", "address", "capacity", "category", "rating", "reviews_count",
                  "distance_km", "lat", "lng", "is_verified", "initials", "services", "price_from", "main_service", "next_slots"]
        read_only_fields = ["rating", "reviews_count", "distance_km", "is_verified"]

    def get_category(self, obj):
        return {"id": obj.category.id, "name": obj.category.name, "slug": obj.category.slug,
                "icon": obj.category.icon, "gradient": obj.category.gradient}

    def get_services(self, obj):
        services = getattr(obj, "active_services", None) or obj.services.filter(is_active=True)
        return [{"id": s.id, "name": s.name, "duration_min": s.duration_min, "price": f"{s.price:.2f}"} for s in services]

    def get_price_from(self, obj):
        return min((s["price"] for s in self.get_services(obj)), key=float, default=None)

    def get_main_service(self, obj):
        return next(iter(self.get_services(obj)), None)

    def get_next_slots(self, obj):
        return [timezone.localtime(s).isoformat() for s in self.context.get("slots", {}).get(obj.id, [])]


class ProviderMeSerializer(ProviderSerializer):
    category_id = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), source="category", write_only=True, required=False)
    calendar_url = serializers.SerializerMethodField()

    class Meta(ProviderSerializer.Meta):
        fields = ProviderSerializer.Meta.fields + ["category_id", "specialty_tg", "specialty_ru", "specialty_en", "calendar_url"]
        extra_kwargs = {"capacity": {"min_value": 1, "max_value": 50}}

    def get_calendar_url(self, obj):
        return self.context["request"].build_absolute_uri(f"/api/calendar/{obj.calendar_token}.ics")


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    service_name = serializers.CharField(source="booking.service.name", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "booking", "rating", "comment", "author", "service_name", "created_at"]

    def get_author(self, obj):
        return obj.booking.customer.first_name or obj.booking.customer.username

    def validate_booking(self, booking):
        if booking.customer_id != self.context["request"].user.id:
            raise serializers.ValidationError(_("You can review only your own bookings."))
        if booking.status != Booking.Status.DONE:
            raise serializers.ValidationError(_("You can leave a review only after the visit is done."))
        if hasattr(booking, "review"):
            raise serializers.ValidationError(_("You have already reviewed this booking."))
        return booking


class BookingSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.name", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    price = serializers.DecimalField(source="service.price", max_digits=10, decimal_places=2, read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    review = ReviewSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Booking
        fields = ["id", "provider", "provider_name", "service", "service_name", "price", "customer", "customer_name",
                  "customer_phone", "start", "end", "status", "created_at", "updated_at", "review"]
        read_only_fields = ["provider", "customer", "end", "status"]

    def get_customer_name(self, obj):
        return obj.customer.get_full_name() or obj.customer.username

    def validate(self, data):
        if not data["service"].is_active:
            raise serializers.ValidationError({"service": _("This service is not available.")})
        if data["service"].provider.user_id == self.context["request"].user.id:
            raise serializers.ValidationError({"service": _("You cannot book your own service.")})
        if data["start"] <= timezone.now():
            raise serializers.ValidationError({"start": _("You cannot book a time in the past.")})
        return data


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = ["provider"]
