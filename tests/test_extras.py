from datetime import timedelta

import pytest

from myapp.models import Booking, Favorite, Service

from .conftest import at, auth, make_provider, results


pytestmark = pytest.mark.django_db


def book(service, customer, start, status=Booking.Status.PENDING):
    return Booking.objects.create(provider=service.provider, service=service, customer=customer, start=start,
                                  end=start + timedelta(minutes=service.duration_min), status=status)


def test_favorites(now, as_customer, client, provider, service, category):
    other = make_provider("other", category)
    Service.objects.create(provider=other, name="X", duration_min=60, price=1)
    assert as_customer.post("/api/favorites/", {"provider": provider.id}, format="json").status_code == 201
    assert as_customer.post("/api/favorites/", {"provider": provider.id}, format="json").status_code == 200
    assert as_customer.get("/api/favorites/").json() == [provider.id]
    assert [p["id"] for p in results(as_customer.get("/api/providers/", {"favorites": 1}))] == [provider.id]
    assert as_customer.delete(f"/api/favorites/{provider.id}/").status_code == 204
    assert results(as_customer.get("/api/providers/", {"favorites": 1})) == []
    assert as_customer.post("/api/favorites/", {"provider": 999}, format="json").status_code == 400


def test_favorites_need_login(client, provider):
    assert client.get("/api/favorites/").status_code == 401
    assert client.get("/api/providers/", {"favorites": 1}).status_code == 403


def test_favorites_list_is_not_shared_by_cache(now, as_customer, stranger, provider, service):
    Favorite.objects.create(user=stranger, provider=provider)
    assert len(results(auth(stranger).get("/api/providers/", {"favorites": 1}))) == 1
    assert results(as_customer.get("/api/providers/", {"favorites": 1})) == []


def test_reschedule(now, as_customer, service, customer):
    b = book(service, customer, at(7, 9), Booking.Status.CONFIRMED)
    r = as_customer.post(f"/api/bookings/{b.id}/reschedule/", {"start": at(7, 11).isoformat()}, format="json")
    assert r.status_code == 200, r.content
    b.refresh_from_db()
    assert b.start == at(7, 11) and b.end == at(7, 12) and b.status == "pending"


def test_reschedule_to_overlapping_own_time_is_ok(now, as_customer, service, customer, category):
    long = Service.objects.create(provider=service.provider, name="Long", duration_min=60, price=1)
    b = book(long, customer, at(7, 9))
    r = as_customer.post(f"/api/bookings/{b.id}/reschedule/", {"start": at(7, 10).isoformat()}, format="json")
    assert r.status_code == 200, r.content


def test_reschedule_to_taken_time(now, as_customer, stranger, service, customer):
    b = book(service, customer, at(7, 9))
    book(service, stranger, at(7, 10))
    r = as_customer.post(f"/api/bookings/{b.id}/reschedule/", {"start": at(7, 10).isoformat()}, format="json")
    assert r.status_code == 400


def test_reschedule_rules(now, as_customer, as_provider, stranger, service, customer):
    b = book(service, customer, at(7, 9))
    assert as_customer.post(f"/api/bookings/{b.id}/reschedule/", {"start": at(6, 10).isoformat()}, format="json").status_code == 400
    assert auth(stranger).post(f"/api/bookings/{b.id}/reschedule/", {"start": at(7, 10).isoformat()}, format="json").status_code == 404
    assert as_provider.post(f"/api/bookings/{b.id}/reschedule/", {"start": at(7, 10).isoformat()}, format="json").status_code == 404
    b.status = "done"
    b.save()
    assert as_customer.post(f"/api/bookings/{b.id}/reschedule/", {"start": at(7, 10).isoformat()}, format="json").status_code == 400


def test_booking_ics(now, as_customer, as_provider, stranger, service, customer):
    b = book(service, customer, at(7, 9))
    r = as_customer.get(f"/api/bookings/{b.id}/ics/")
    assert r.status_code == 200 and r["Content-Type"].startswith("text/calendar")
    body = r.content.decode()
    assert "BEGIN:VEVENT" in body and "DTSTART:20300107T040000Z" in body and "\r\n" in body
    assert as_provider.get(f"/api/bookings/{b.id}/ics/").status_code == 200
    assert auth(stranger).get(f"/api/bookings/{b.id}/ics/").status_code == 404


def test_provider_calendar_feed(now, client, as_provider, provider, service, customer, stranger):
    book(service, customer, at(7, 9))
    book(service, stranger, at(7, 10), Booking.Status.CANCELLED)
    url = as_provider.get("/api/providers/me/").json()["calendar_url"]
    r = client.get(url, HTTP_ACCEPT="text/calendar")
    assert r.status_code == 200 and r.content.decode().count("BEGIN:VEVENT") == 1
    new = as_provider.post("/api/providers/me/calendar-token/").json()["calendar_url"]
    assert new != url
    assert client.get(url).status_code == 404 and client.get(new).status_code == 200


def test_stats(now, client, service, customer, stranger):
    b1 = book(service, customer, at(7, 9), Booking.Status.DONE)
    book(service, stranger, at(7, 10), Booking.Status.CANCELLED)
    b1.confirmed_at = b1.created_at + timedelta(minutes=4)
    b1.save()
    d = client.get("/api/stats/").json()
    assert d["bookings_week"] == 2 and d["providers"] == 1 and d["free_today"] == 1
    assert d["completion_rate"] == 50 and d["avg_confirm_minutes"] == 4.0
    assert client.get("/api/stats/", {"city": "mars"}).status_code == 400


def test_confirm_sets_confirmed_at(now, as_provider, service, customer):
    b = book(service, customer, at(7, 9))
    as_provider.post(f"/api/bookings/{b.id}/status/", {"status": "confirmed"}, format="json")
    b.refresh_from_db()
    assert b.confirmed_at is not None


def test_bookings_ordered_by_update(now, as_customer, service, customer):
    a = book(service, customer, at(7, 9))
    b = book(service, customer, at(7, 10))
    a.status = "confirmed"
    a.save()
    rows = results(as_customer.get("/api/bookings/", {"ordering": "-updated_at"}))
    assert rows[0]["id"] == a.id and "updated_at" in rows[0]


def test_change_password(client, as_customer, customer):
    r = as_customer.post("/api/auth/password/", {"old_password": "bad", "new_password": "newpass1"}, format="json")
    assert r.status_code == 400 and "old_password" in r.json()["errors"]
    r = as_customer.post("/api/auth/password/", {"old_password": "secret123", "new_password": "newpass1"}, format="json")
    assert r.status_code == 200 and r.json()["access"]
    assert client.post("/api/auth/login/", {"username": "cli", "password": "newpass1"}).status_code == 200
