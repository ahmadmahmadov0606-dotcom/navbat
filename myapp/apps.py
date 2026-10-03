from django.apps import AppConfig
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save


class MyappConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "myapp"
    verbose_name = "Navbat"

    def ready(self):
        from .models import Booking, Category, DayOff, Provider, Review, Service, WorkingHours

        def new_catalog_version(**kwargs):
            cache.add("catalog:version", 1, None)
            cache.incr("catalog:version")

        def update_rating(instance, **kwargs):
            instance.booking.provider.update_rating()

        for model in (Booking, Category, DayOff, Provider, Review, Service, WorkingHours):
            post_save.connect(new_catalog_version, sender=model, weak=False)
            post_delete.connect(new_catalog_version, sender=model, weak=False)
        post_save.connect(update_rating, sender=Review, weak=False)
        post_delete.connect(update_rating, sender=Review, weak=False)
