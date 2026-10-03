import pytest

from myapp.models import DayOff, Service, WorkingHours

from .conftest import auth, make_provider, results


pytestmark = pytest.mark.django_db

ENDPOINTS = ["/api/services/", "/api/working-hours/", "/api/days-off/", "/api/providers/me/"]


@pytest.mark.parametrize("url", ENDPOINTS)
def test_anonymous_gets_401(client, url):
    assert client.get(url).status_code == 401


@pytest.mark.parametrize("url", ENDPOINTS)
def test_customer_gets_403(as_customer, url):
    assert as_customer.get(url).status_code == 403


def test_provider_me(as_provider, provider):
    r = as_provider.get("/api/providers/me/")
    assert r.status_code == 200 and r.json()["id"] == provider.id
    r = as_provider.patch("/api/providers/me/", {"name": "New", "rating": 5}, format="json")
    assert r.status_code == 200
    provider.refresh_from_db()
    assert provider.name == "New" and provider.rating == 0


def test_service_crud(as_provider, provider):
    r = as_provider.post("/api/services/", {"name": "Cut", "duration_min": 30, "price": "50"}, format="json")
    assert r.status_code == 201, r.content
    sid = r.json()["id"]
    assert Service.objects.get(pk=sid).provider == provider
    assert as_provider.patch(f"/api/services/{sid}/", {"price": "60"}, format="json").status_code == 200
    assert as_provider.delete(f"/api/services/{sid}/").status_code == 204


def test_working_hours_crud_and_validation(as_provider, provider):
    r = as_provider.post("/api/working-hours/", {"weekday": 0, "start": "18:00", "end": "17:00"}, format="json")
    assert r.status_code == 400
    r = as_provider.post("/api/working-hours/", {"weekday": 0, "start": "13:00", "end": "17:00"}, format="json")
    assert r.status_code == 201, r.content


def test_days_off(as_provider, provider):
    r = as_provider.post("/api/days-off/", {"date": "2030-01-08"}, format="json")
    assert r.status_code == 201
    assert DayOff.objects.get().provider == provider


def test_provider_sees_only_own_rows(provider, category):
    other = make_provider("other", category)
    s = Service.objects.create(provider=other, name="Theirs", duration_min=30, price=1)
    c = auth(provider.user)
    assert all(row["provider"] == provider.id for row in results(c.get("/api/working-hours/")))
    assert results(c.get("/api/services/")) == []
    assert c.patch(f"/api/services/{s.id}/", {"price": "1"}, format="json").status_code == 404
    assert c.delete(f"/api/services/{s.id}/").status_code == 404
    wh = WorkingHours.objects.filter(provider=other).first()
    assert c.delete(f"/api/working-hours/{wh.id}/").status_code == 404
