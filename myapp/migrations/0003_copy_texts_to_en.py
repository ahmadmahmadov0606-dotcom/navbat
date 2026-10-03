"""Existing rows were written in English before modeltranslation: copy them to *_en."""
from django.db import migrations

FIELDS = {"Category": ["name", "stats_label"], "Provider": ["specialty"], "Service": ["name"]}


def forwards(apps, schema_editor):
    for model_name, fields in FIELDS.items():
        Model = apps.get_model("myapp", model_name)
        for obj in Model.objects.all():
            changed = []
            for f in fields:
                if getattr(obj, f) and not getattr(obj, f"{f}_en"):
                    setattr(obj, f"{f}_en", getattr(obj, f))
                    changed.append(f"{f}_en")
            if changed:
                obj.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("myapp", "0002_reviews_translations_indexes")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
