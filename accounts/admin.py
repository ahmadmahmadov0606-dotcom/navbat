from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ["username", "first_name", "last_name", "phone", "role", "is_staff", "date_joined"]
    list_filter = ["role", "is_staff", "is_active"]
    search_fields = ["username", "first_name", "last_name", "phone", "email"]
    readonly_fields = ["date_joined", "last_login"]
    fieldsets = UserAdmin.fieldsets + (("Navbat", {"fields": ("phone", "role")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Navbat", {"fields": ("phone", "role")}),)
