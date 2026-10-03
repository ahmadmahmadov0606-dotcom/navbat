import threading

import pytest
from django.db import connection

from myapp.models import Booking

from .conftest import at, auth, results


pytestmark = pytest.mark.django_db


def post_booking(c, service, start):
    return c.post("/api/bookings/", {"service": service.id, "start": start.isoformat()}, format="json")


def test_create_booking(now, as_customer, service, customer):
    r = post_booking(as_customer, service, at(7, 10))
    assert r.status_code == 201, r.content
    b = Booking.objects.get()
    assert b.customer == customer and b.provider == service.provider
    assert b.end == at(7, 11) and b.status == "pending"


def test_create_booking_unauthenticated(now, client, service):
    assert post_booking(client, service, at(7, 10)).status_code == 401
    assert not Booking.objects.exists()


def test_taken_slot(now, as_customer, stranger, service):
    assert post_booking(auth(stranger), service, at(7, 10)).status_code == 201
    r = post_booking(as_customer, service, at(7, 10))
    assert r.status_code == 400
    assert Booking.objects.count() == 1


def test_time_outside_grid(now, as_customer, service):
    assert post_booking(as_customer, service, at(7, 10, 15)).status_code == 400


def test_outside_working_hours(now, as_customer, service):
    assert post_booking(as_customer, service, at(7, 18)).status_code == 400


def test_booking_list_is_private(now, as_customer, stranger, service):
    post_booking(auth(stranger), service, at(7, 10))
    assert results(as_customer.get("/api/bookings/")) == []


def test_provider_sees_bookings_made_to_him(now, as_customer, as_provider, service):
    post_booking(as_customer, service, at(7, 10))
    rows = results(as_provider.get("/api/bookings/", {"as": "provider"}))
    assert len(rows) == 1 and rows[0]["customer_name"] == "cli"


@pytest.mark.django_db(transaction=True)
def test_double_booking_race(now, service, django_user_model):
    users = [django_user_model.objects.create_user(username=f"u{i}", password="x") for i in range(6)]
    barrier = threading.Barrier(len(users))
    codes, errors = [], []

    def worker(u):
        try:
            c = auth(u)
            barrier.wait()
            codes.append(post_booking(c, service, at(7, 10)).status_code)
        except Exception as e:
            errors.append(repr(e))
        finally:
            connection.close()

    threads = [threading.Thread(target=worker, args=(u,)) for u in users]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors, errors
    assert sorted(codes) == [201] + [400] * (len(users) - 1), codes
    assert Booking.objects.filter(start=at(7, 10)).count() == 1


@pytest.fixture
def booking(now, service, customer):
    return Booking.objects.create(provider=service.provider, service=service, customer=customer,
                                  start=at(7, 10), end=at(7, 11))


def set_status(c, booking, status):
    return c.post(f"/api/bookings/{booking.id}/status/", {"status": status}, format="json")


def test_customer_can_cancel(as_customer, booking):
    assert set_status(as_customer, booking, "cancelled").status_code == 200
    booking.refresh_from_db()
    assert booking.status == "cancelled"


@pytest.mark.parametrize("status", ["confirmed", "done", "pending"])
def test_customer_cannot_set_other_status(as_customer, booking, status):
    assert set_status(as_customer, booking, status).status_code == 400
    booking.refresh_from_db()
    assert booking.status == "pending"


@pytest.mark.parametrize("status", ["confirmed", "done", "cancelled"])
def test_provider_can_set_any_status(as_provider, booking, status):
    assert set_status(as_provider, booking, status).status_code == 200
    booking.refresh_from_db()
    assert booking.status == status


def test_provider_invalid_status(as_provider, booking):
    assert set_status(as_provider, booking, "lost").status_code == 400


def test_stranger_gets_404(stranger, booking):
    assert set_status(auth(stranger), booking, "cancelled").status_code == 404
    assert auth(stranger).get(f"/api/bookings/{booking.id}/").status_code == 404
