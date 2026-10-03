from datetime import date, time

import pytest

from myapp.models import Booking, DayOff, Service
from myapp.views import free_slots

from .conftest import at, make_provider

pytestmark = pytest.mark.django_db
MON = date(2030, 1, 7)


def book(provider, service, customer, start, status=Booking.Status.PENDING, minutes=None):
    from datetime import timedelta
    return Booking.objects.create(
        provider=provider, service=service, customer=customer, start=start,
        end=start + timedelta(minutes=minutes or service.duration_min), status=status,
    )


def test_slots_follow_working_hours(now, provider, service):
    assert free_slots(provider, service, MON) == [at(7, 9), at(7, 10), at(7, 11)]


def test_slots_use_service_duration(now, provider):
    s = Service.objects.create(provider=provider, name="Short", duration_min=45, price=1)
    assert free_slots(provider, s, MON) == [at(7, 9), at(7, 9, 45), at(7, 10, 30), at(7, 11, 15)]


def test_long_service_that_does_not_fit(now, provider):
    s = Service.objects.create(provider=provider, name="Long", duration_min=240, price=1)
    assert free_slots(provider, s, MON) == []


def test_day_off(now, provider, service):
    DayOff.objects.create(provider=provider, date=MON)
    assert free_slots(provider, service, MON) == []


def test_weekday_without_hours(now, category):
    p = make_provider("weekdays", category, weekdays=range(5))
    s = Service.objects.create(provider=p, name="X", duration_min=60, price=1)
    assert free_slots(p, s, date(2030, 1, 12)) == []


def test_split_working_hours(now, category):
    p = make_provider("split", category, hours=((time(9), time(11)), (time(14), time(16))))
    s = Service.objects.create(provider=p, name="X", duration_min=60, price=1)
    assert free_slots(p, s, MON) == [at(7, 9), at(7, 10), at(7, 14), at(7, 15)]


def test_existing_booking_blocks_overlapping_slots(now, provider, service, customer):
    book(provider, service, customer, at(7, 10))
    assert free_slots(provider, service, MON) == [at(7, 9), at(7, 11)]


def test_booking_of_other_duration_blocks_both_slots(now, provider, service, customer):
    book(provider, service, customer, at(7, 9, 30), minutes=60)
    assert free_slots(provider, service, MON) == [at(7, 11)]


def test_cancelled_booking_frees_slot(now, provider, service, customer):
    book(provider, service, customer, at(7, 10), status=Booking.Status.CANCELLED)
    assert at(7, 10) in free_slots(provider, service, MON)


def test_capacity_more_than_one(now, category, customer, stranger):
    p = make_provider("wash", category, capacity=2)
    s = Service.objects.create(provider=p, name="Wash", duration_min=60, price=1)
    book(p, s, customer, at(7, 10))
    assert at(7, 10) in free_slots(p, s, MON)
    book(p, s, stranger, at(7, 10))
    assert at(7, 10) not in free_slots(p, s, MON)


def test_past_times_are_hidden(now, provider, service):
    now.set(at(7, 10, 30))
    assert free_slots(provider, service, MON) == [at(7, 11)]


def test_past_day_is_empty(now, provider, service):
    assert free_slots(provider, service, date(2030, 1, 6)) == []


def test_slots_endpoint(now, client, provider, service):
    r = client.get(f"/api/providers/{provider.id}/slots/", {"date": "2030-01-07", "service": service.id})
    assert r.status_code == 200
    assert [s[11:16] for s in r.json()["slots"]] == ["09:00", "10:00", "11:00"]


def test_slots_endpoint_bad_date(client, provider, service):
    r = client.get(f"/api/providers/{provider.id}/slots/", {"date": "tomorrow", "service": service.id})
    assert r.status_code == 400


def test_slots_endpoint_service_of_other_provider(client, provider, category):
    other = make_provider("other_doc", category)
    s = Service.objects.create(provider=other, name="X", duration_min=60, price=1)
    r = client.get(f"/api/providers/{provider.id}/slots/", {"date": "2030-01-07", "service": s.id})
    assert r.status_code == 400 and "service" in r.json()["errors"]
