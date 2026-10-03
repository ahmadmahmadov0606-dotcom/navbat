from django.contrib import admin
from modeltranslation.admin import TranslationAdmin, TranslationTabularInline
from modeltranslation.translator import TranslationOptions, translator

from .models import Booking, Category, DayOff, Favorite, Provider, Review, Service, WorkingHours

for model, fields in ((Category, ("name", "stats_label")), (Provider, ("specialty",)), (Service, ("name",))):
    translator.register(model, type(f"{model.__name__}TR", (TranslationOptions,), {"fields": fields}))


class ServiceInline(TranslationTabularInline):
    model, extra = Service, 0


class WorkingHoursInline(admin.TabularInline):
    model, extra = WorkingHours, 0


class DayOffInline(admin.TabularInline):
    model, extra = DayOff, 0


class ReviewInline(admin.StackedInline):
    model, extra, readonly_fields = Review, 0, ["created_at"]


@admin.register(Category)
class CategoryAdmin(TranslationAdmin):
    list_display = ["name", "slug", "icon", "stats_label"]
    search_fields = ["name_tg", "name_ru", "name_en", "slug"]
    prepopulated_fields = {"slug": ("name_en",)}


@admin.register(Provider)
class ProviderAdmin(TranslationAdmin):
    list_display = ["name", "category", "city", "rating", "reviews_count", "capacity", "is_verified"]
    list_filter = ["category", "city", "is_verified"]
    list_editable = ["is_verified"]
    search_fields = ["name", "specialty_tg", "specialty_ru", "specialty_en", "user__username", "user__phone", "address"]
    readonly_fields = ["rating", "reviews_count"]
    autocomplete_fields = ["user"]
    list_select_related = ["category"]
    inlines = [ServiceInline, WorkingHoursInline, DayOffInline]


@admin.register(Service)
class ServiceAdmin(TranslationAdmin):
    list_display = ["name", "provider", "duration_min", "price", "is_active"]
    list_filter = ["is_active", "provider__category"]
    search_fields = ["name_tg", "name_ru", "name_en", "provider__name"]
    list_select_related = ["provider"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["id", "customer", "provider", "service", "start", "status", "created_at"]
    list_filter = ["status", "provider__category", "provider__city", "start"]
    search_fields = ["customer__username", "customer__phone", "provider__name", "service__name_tg", "service__name_ru", "service__name_en"]
    readonly_fields = ["created_at", "confirmed_at", "updated_at"]
    autocomplete_fields = ["customer", "provider", "service"]
    list_select_related = ["customer", "provider", "service"]
    date_hierarchy = "start"
    inlines = [ReviewInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["booking", "rating", "created_at"]
    list_filter = ["rating", "booking__provider__category"]
    search_fields = ["comment", "booking__provider__name", "booking__customer__username"]
    readonly_fields = ["created_at"]
    raw_id_fields = ["booking"]


@admin.register(WorkingHours, DayOff, Favorite)
class SimpleAdmin(admin.ModelAdmin):
    search_fields = ["provider__name"]
    list_select_related = ["provider"]
