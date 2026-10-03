import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count
from django.utils.translation import gettext_lazy as _


class City(models.TextChoices):
    DUSHANBE = "dushanbe", _("Dushanbe")
    KHUJAND = "khujand", _("Khujand")
    BOKHTAR = "bokhtar", _("Bokhtar")


CITY_CENTERS = {"dushanbe": (38.5598, 68.7870), "khujand": (40.2826, 69.6222), "bokhtar": (37.8364, 68.7803)}


class Category(models.Model):
    name = models.CharField(_("name"), max_length=100)
    slug = models.SlugField(unique=True)
    icon = models.CharField(max_length=50, default="work", help_text="Material Symbols icon name")
    gradient = models.CharField(max_length=80, default="from-primary to-primary-container")
    stats_label = models.CharField(max_length=50, blank=True, help_text='Shown on the card, e.g. "180+ Doctors"')

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("category"), _("categories"), ["id"]

    def __str__(self):
        return self.name


class Provider(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="providers")
    name = models.CharField(_("name"), max_length=150)
    specialty = models.CharField(_("specialty"), max_length=150, blank=True)
    city = models.CharField(_("city"), max_length=20, choices=City.choices, default=City.DUSHANBE, db_index=True)
    address = models.CharField(_("address"), max_length=255, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    capacity = models.PositiveSmallIntegerField(default=1, help_text="Clients that can be served at the same time")
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    distance_km = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    lat = models.FloatField(_("latitude"), null=True, blank=True)
    lng = models.FloatField(_("longitude"), null=True, blank=True)
    is_verified = models.BooleanField(default=True)
    calendar_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("provider"), _("providers"), ["id"]

    def __str__(self):
        return self.name

    @property
    def initials(self):
        words = [w for w in self.name.replace("&", " ").split() if w.strip(".").lower() not in ("dr", "the")]
        return "".join(w[0] for w in words[:2]).upper()

    def update_rating(self):
        agg = Review.objects.filter(booking__provider=self).aggregate(avg=Avg("rating"), n=Count("id"))
        self.rating, self.reviews_count = round(agg["avg"] or 0, 2), agg["n"]
        self.save(update_fields=["rating", "reviews_count"])


class Service(models.Model):
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="services")
    name = models.CharField(_("name"), max_length=150)
    duration_min = models.PositiveIntegerField(_("duration (min)"), validators=[MinValueValidator(5), MaxValueValidator(720)])
    price = models.DecimalField(_("price"), max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("service"), _("services"), ["id"]

    def __str__(self):
        return f"{self.name} ({self.provider})"


class WorkingHours(models.Model):
    WEEKDAYS = [(0, _("Monday")), (1, _("Tuesday")), (2, _("Wednesday")), (3, _("Thursday")),
                (4, _("Friday")), (5, _("Saturday")), (6, _("Sunday"))]
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="hours")
    weekday = models.PositiveSmallIntegerField(_("weekday"), choices=WEEKDAYS)
    start = models.TimeField(_("start"))
    end = models.TimeField(_("end"))

    class Meta:
        verbose_name = verbose_name_plural = _("working hours")
        ordering = ["weekday", "start"]
        indexes = [models.Index(fields=["provider", "weekday"])]

    def __str__(self):
        return f"{self.provider} {self.get_weekday_display()} {self.start:%H:%M}-{self.end:%H:%M}"


class DayOff(models.Model):
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="days_off")
    date = models.DateField(_("date"))

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("day off"), _("days off"), ["date"]
        constraints = [models.UniqueConstraint(fields=["provider", "date"], name="unique_day_off")]
        indexes = [models.Index(fields=["provider", "date"])]

    def __str__(self):
        return f"{self.provider} off {self.date}"


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        CONFIRMED = "confirmed", _("Confirmed")
        CANCELLED = "cancelled", _("Cancelled")
        DONE = "done", _("Done")

    ACTIVE = (Status.PENDING, Status.CONFIRMED)

    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="bookings")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="bookings")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    start = models.DateTimeField(_("start"))
    end = models.DateTimeField(_("end"))
    status = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("booking"), _("bookings"), ["-start"]
        indexes = [models.Index(fields=["provider", "start"]), models.Index(fields=["customer", "start"])]

    def __str__(self):
        return f"{self.customer} -> {self.provider} {self.start:%Y-%m-%d %H:%M}"


class Review(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="review")
    rating = models.PositiveSmallIntegerField(_("rating"), validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(_("comment"), blank=True, max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("review"), _("reviews"), ["-created_at"]
        constraints = [models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5), name="review_rating_1_5")]

    def __str__(self):
        return f"{self.rating}★ {self.booking}"


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name, verbose_name_plural, ordering = _("favorite"), _("favorites"), ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "provider"], name="unique_favorite")]
