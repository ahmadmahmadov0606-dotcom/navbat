from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "customer", _("Customer")
        PROVIDER = "provider", _("Provider")

    phone = models.CharField(_("phone"), max_length=20, blank=True)
    role = models.CharField(_("role"), max_length=10, choices=Role.choices, default=Role.CUSTOMER)
