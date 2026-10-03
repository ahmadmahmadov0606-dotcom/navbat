import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def fill_calendar_tokens(apps, schema_editor):
    Provider = apps.get_model("myapp", "Provider")
    for p in Provider.objects.all():
        p.calendar_token = uuid.uuid4()
        p.save(update_fields=["calendar_token"])


def fill_booking_times(apps, schema_editor):
    Booking = apps.get_model("myapp", "Booking")
    Booking.objects.update(updated_at=models.F("created_at"))
    Booking.objects.filter(status__in=["confirmed", "done"]).update(confirmed_at=models.F("created_at"))


class Migration(migrations.Migration):
    dependencies = [
        ("myapp", "0003_copy_texts_to_en"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # calendar token: add nullable, fill a different value per row, then make it unique
        migrations.AddField("provider", "calendar_token", models.UUIDField(null=True, editable=False)),
        migrations.RunPython(fill_calendar_tokens, migrations.RunPython.noop),
        migrations.AlterField("provider", "calendar_token",
                              models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
        migrations.AddField("booking", "confirmed_at", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("booking", "updated_at",
                            models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
                            preserve_default=False),
        migrations.RunPython(fill_booking_times, migrations.RunPython.noop),
        migrations.CreateModel(
            name="Favorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("provider", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                               related_name="favorited_by", to="myapp.provider")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                           related_name="favorites", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "favorite", "verbose_name_plural": "favorites", "ordering": ["-created_at"]},
        ),
        migrations.AddConstraint("favorite", models.UniqueConstraint(fields=("user", "provider"), name="unique_favorite")),
    ]
