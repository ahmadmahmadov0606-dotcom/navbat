from django.core.validators import RegexValidator
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from myapp.models import Category, City, Provider

from .models import User

phone_validator = RegexValidator(r"^\+?[0-9 ()\-]{7,20}$", _("Enter a valid phone number, e.g. +992 90 123 4567."))


class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20, validators=[phone_validator])
    provider_id = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    is_admin = serializers.BooleanField(source="is_staff", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "phone", "role", "provider_id", "category", "is_admin"]
        read_only_fields = ["id", "username", "role"]

    def get_provider_id(self, obj):
        return getattr(getattr(obj, "provider", None), "id", None)

    def get_category(self, obj):
        provider = getattr(obj, "provider", None)
        if not provider:
            return None
        c = provider.category
        return {"id": c.id, "slug": c.slug, "name": c.name, "icon": c.icon, "gradient": c.gradient}


class RegisterSerializer(UserSerializer):

    password = serializers.CharField(write_only=True, min_length=6, max_length=128)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.CUSTOMER)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), write_only=True, required=False)
    name = serializers.CharField(write_only=True, required=False, max_length=150)
    address = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    city = serializers.ChoiceField(choices=City.choices, write_only=True, default=City.DUSHANBE)

    class Meta(UserSerializer.Meta):
        fields = ["username", "password", "first_name", "last_name", "phone", "role", "category", "name", "address", "city"]
        read_only_fields = []

    def validate(self, attrs):
        if attrs.get("role") == User.Role.PROVIDER:
            errors = {}
            if not attrs.get("category"):
                errors["category"] = [_("Choose a category.")]
            if not (attrs.get("name") or "").strip():
                errors["name"] = [_("Enter the name of your business.")]
            if errors:
                raise serializers.ValidationError(errors)
        return attrs

    @transaction.atomic
    def create(self, data):
        profile = {k: data.pop(k, None) for k in ("category", "name", "address", "city")}
        user = User.objects.create_user(**data)
        if user.role == User.Role.PROVIDER:
            Provider.objects.create(user=user, category=profile["category"], name=profile["name"].strip(),
                                    address=profile["address"] or "", city=profile["city"])
        return user


class PasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6, max_length=128)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError(_("The current password is wrong."))
        return value


class LoginSerializer(TokenObtainPairSerializer):
    role = serializers.ChoiceField(choices=["customer", "provider", "admin"], required=False, write_only=True)

    def validate(self, attrs):
        role = attrs.pop("role", None)
        data = super().validate(attrs)
        if role == "provider" and not hasattr(self.user, "provider"):
            raise serializers.ValidationError({"role": _("This account is not a specialist. Register as a specialist first.")})
        if role == "admin" and not self.user.is_staff:
            raise serializers.ValidationError({"role": _("This account is not an administrator.")})
        data["role"] = role or ("provider" if hasattr(self.user, "provider") else "customer")
        return data
