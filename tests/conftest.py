from datetime import datetime, time
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from django.core.cache import cache
from django.utils import translation
from rest_framework.test import APIClient

from accounts.models import User
from myapp.models import Category, Provider, Service, WorkingHours

TZ = ZoneInfo("Asia/Dushanbe")
NOW = datetime(2030, 1, 7, 8, 0, tzinfo=TZ)


def at(day, hh, mm=0):
    return datetime(2030, 1, day, hh, mm, tzinfo=TZ)


@pytest.fixture(autouse=True)
def _clean_state():
    cache.clear()
    translation.activate("tg")
    yield
    cache.clear()
    translation.activate("tg")


@pytest.fixture
def now():
    class Clock:
        value = NOW

        def set(self, dt):
            self.value = dt

    clock = Clock()
    with mock.patch("django.utils.timezone.now", side_effect=lambda: clock.value):
        yield clock


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def category(db):
    return Category.objects.create(name="Doctor", slug="doctor")


def make_provider(username, category, capacity=1, hours=((time(9), time(12)),), weekdays=range(7)):
    user = User.objects.create_user(username=username, password="secret123", role=User.Role.PROVIDER)
    p = Provider.objects.create(user=user, category=category, name=username.title(), capacity=capacity)
    for d in weekdays:
        for start, end in hours:
            WorkingHours.objects.create(provider=p, weekday=d, start=start, end=end)
    return p


@pytest.fixture
def provider(category):
    return make_provider("doc", category)


@pytest.fixture
def service(provider):
    return Service.objects.create(provider=provider, name="Checkup", duration_min=60, price=100)


@pytest.fixture
def customer(db):
    return User.objects.create_user(username="cli", password="secret123")


@pytest.fixture
def stranger(db):
    return User.objects.create_user(username="other", password="secret123")


def auth(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def as_customer(customer):
    return auth(customer)


@pytest.fixture
def as_provider(provider):
    return auth(provider.user)


def results(resp):
    data = resp.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data
