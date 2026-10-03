import pytest

from accounts.models import User
from myapp.models import Provider

pytestmark = pytest.mark.django_db


def test_register_customer_returns_tokens(client):
    r = client.post("/api/auth/register/", {"username": "ali", "password": "secret123", "phone": "+992900000001"})
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["access"] and body["refresh"]
    assert body["user"]["role"] == "customer"
    assert User.objects.get(username="ali").check_password("secret123")


def test_register_provider_creates_profile(client, category):
    r = client.post("/api/auth/register/", {
        "username": "barber", "password": "secret123", "role": "provider",
        "category": category.id, "name": "Best Barber", "address": "Rudaki 1",
    })
    assert r.status_code == 201, r.content
    p = Provider.objects.get(user__username="barber")
    assert p.name == "Best Barber" and p.category == category


def test_register_provider_needs_category_and_name(client):
    r = client.post("/api/auth/register/", {"username": "x", "password": "secret123", "role": "provider"})
    assert r.status_code == 400
    assert not User.objects.filter(username="x").exists()


def test_register_duplicate_username(client, customer):
    r = client.post("/api/auth/register/", {"username": customer.username, "password": "secret123"})
    assert r.status_code == 400


def test_register_short_password(client):
    r = client.post("/api/auth/register/", {"username": "short", "password": "123"})
    assert r.status_code == 400


def test_login_and_refresh(client, customer):
    r = client.post("/api/auth/login/", {"username": "cli", "password": "secret123"})
    assert r.status_code == 200
    tokens = r.json()
    r = client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]})
    assert r.status_code == 200 and r.json()["access"]
    client.credentials(HTTP_AUTHORIZATION="Bearer " + r.json()["access"])
    me = client.get("/api/auth/me/")
    assert me.status_code == 200 and me.json()["username"] == "cli"


def test_login_wrong_password(client, customer):
    r = client.post("/api/auth/login/", {"username": "cli", "password": "nope"})
    assert r.status_code == 401


def test_refresh_with_garbage(client):
    assert client.post("/api/auth/refresh/", {"refresh": "garbage"}).status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me/").status_code == 401


def test_me_cannot_change_role(as_customer, customer):
    r = as_customer.patch("/api/auth/me/", {"role": "provider", "first_name": "Ali"})
    assert r.status_code == 200
    customer.refresh_from_db()
    assert customer.role == "customer" and customer.first_name == "Ali"


def test_login_with_role(client, customer, provider, django_user_model):
    django_user_model.objects.create_superuser("boss", "b@x.tj", "secret123")
    login = lambda u, role: client.post("/api/auth/login/", {"username": u, "password": "secret123", "role": role})
    assert login("cli", "customer").json()["role"] == "customer"
    assert login("doc", "provider").json()["role"] == "provider"
    r = login("cli", "provider")
    assert r.status_code == 400 and "role" in r.json()["errors"]
    assert login("cli", "admin").status_code == 400
    r = login("boss", "admin")
    assert r.status_code == 200 and r.json()["role"] == "admin"
    assert client.get("/admin/").status_code == 200  # the admin role also opens the Django admin session
