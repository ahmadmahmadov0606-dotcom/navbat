from datetime import time, timedelta

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.throttling import ScopedRateThrottle

from myapp.models import Booking, Category, DayOff, Provider, Review, Service

from .conftest import at, auth, make_provider, results


pytestmark = pytest.mark.django_db


def book(service, customer, start, status=Booking.Status.PENDING):
    return Booking.objects.create(provider=service.provider, service=service, customer=customer, start=start,
                                  end=start + timedelta(minutes=service.duration_min), status=status)


def post_booking(c, service, start):
    return c.post("/api/bookings/", {"service": service.id, "start": start.isoformat()}, format="json")


def test_review_only_after_done(now, as_customer, service, customer):
    b = book(service, customer, at(7, 10))
    r = as_customer.post("/api/reviews/", {"booking": b.id, "rating": 5}, format="json")
    assert r.status_code == 400 and "booking" in r.json()["errors"]


def test_review_updates_provider_rating(now, as_customer, service, customer, provider):
    b1 = book(service, customer, at(7, 9), Booking.Status.DONE)
    b2 = book(service, customer, at(7, 10), Booking.Status.DONE)
    assert as_customer.post("/api/reviews/", {"booking": b1.id, "rating": 5, "comment": "Great"}, format="json").status_code == 201
    assert as_customer.post("/api/reviews/", {"booking": b2.id, "rating": 4}, format="json").status_code == 201
    provider.refresh_from_db()
    assert provider.reviews_count == 2 and float(provider.rating) == 4.5
    Review.objects.get(booking=b2).delete()
    provider.refresh_from_db()
    assert provider.reviews_count == 1 and float(provider.rating) == 5


def test_one_review_per_booking(now, as_customer, service, customer):
    b = book(service, customer, at(7, 9), Booking.Status.DONE)
    as_customer.post("/api/reviews/", {"booking": b.id, "rating": 5}, format="json")
    assert as_customer.post("/api/reviews/", {"booking": b.id, "rating": 3}, format="json").status_code == 400
    assert Review.objects.count() == 1


def test_cannot_review_someone_elses_booking(now, stranger, service, customer):
    b = book(service, customer, at(7, 9), Booking.Status.DONE)
    assert auth(stranger).post("/api/reviews/", {"booking": b.id, "rating": 5}, format="json").status_code == 400


@pytest.mark.parametrize("rating", [0, 6, "x"])
def test_review_rating_range(now, as_customer, service, customer, rating):
    b = book(service, customer, at(7, 9), Booking.Status.DONE)
    assert as_customer.post("/api/reviews/", {"booking": b.id, "rating": rating}, format="json").status_code == 400


def test_review_requires_login(client):
    assert client.post("/api/reviews/", {"booking": 1, "rating": 5}, format="json").status_code == 401


def test_list_reviews_of_provider(now, as_customer, client, service, customer, provider):
    b = book(service, customer, at(7, 9), Booking.Status.DONE)
    as_customer.post("/api/reviews/", {"booking": b.id, "rating": 5, "comment": "Top"}, format="json")
    rows = results(client.get(f"/api/providers/{provider.id}/reviews/"))
    assert rows[0]["comment"] == "Top" and rows[0]["author"] == "cli"
    assert len(results(client.get("/api/reviews/", {"provider": provider.id}))) == 1
    booking = results(as_customer.get("/api/bookings/"))[0]
    assert booking["review"]["rating"] == 5


def test_cannot_book_in_the_past(now, as_customer, service):
    now.set(at(7, 10, 30))
    r = post_booking(as_customer, service, at(7, 10))
    assert r.status_code == 400 and "start" in r.json()["errors"]


def test_cannot_book_own_service(now, as_provider, service):
    r = post_booking(as_provider, service, at(7, 10))
    assert r.status_code == 400 and "service" in r.json()["errors"]


def test_cannot_overlap_own_bookings(now, as_customer, service, category):
    other = make_provider("barber", category)
    s2 = Service.objects.create(provider=other, name="Cut", duration_min=60, price=1)
    assert post_booking(as_customer, service, at(7, 10)).status_code == 201
    r = post_booking(as_customer, s2, at(7, 10))
    assert r.status_code == 400 and "start" in r.json()["errors"]
    assert post_booking(as_customer, s2, at(7, 11)).status_code == 201


def test_cannot_book_inactive_service(now, as_customer, service):
    service.is_active = False
    service.save()
    assert post_booking(as_customer, service, at(7, 10)).status_code == 400


def test_customer_cannot_cancel_done_booking(now, as_customer, service, customer):
    b = book(service, customer, at(7, 9), Booking.Status.DONE)
    assert as_customer.post(f"/api/bookings/{b.id}/status/", {"status": "cancelled"}, format="json").status_code == 400


def test_booking_filters_and_pagination(now, as_customer, service, customer):
    for h in (9, 10, 11):
        book(service, customer, at(7, h))
    book(service, customer, at(8, 9), Booking.Status.CANCELLED)
    body = as_customer.get("/api/bookings/", {"page_size": 2}).json()
    assert body["count"] == 4 and len(body["results"]) == 2 and body["next"]
    assert as_customer.get("/api/bookings/", {"status": "cancelled"}).json()["count"] == 1
    assert as_customer.get("/api/bookings/", {"date": "2030-01-08"}).json()["count"] == 1
    rows = results(as_customer.get("/api/bookings/", {"date": "2030-01-07", "ordering": "start"}))
    assert [r["start"][11:16] for r in rows] == ["09:00", "10:00", "11:00"]
    assert as_customer.get("/api/bookings/", {"status": "lost"}).status_code == 400


def test_as_provider_for_customer_is_403(as_customer):
    assert as_customer.get("/api/bookings/", {"as": "provider"}).status_code == 403


def test_working_hours_must_not_overlap(as_provider, provider):
    r = as_provider.post("/api/working-hours/", {"weekday": 0, "start": "11:00", "end": "13:00"}, format="json")
    assert r.status_code == 400
    r = as_provider.post("/api/working-hours/", {"weekday": 0, "start": "12:00", "end": "13:00"}, format="json")
    assert r.status_code == 201
    wh = provider.hours.get(weekday=0, start=time(9))
    r = as_provider.patch(f"/api/working-hours/{wh.id}/", {"end": "11:30"}, format="json")
    assert r.status_code == 200


def test_day_off_is_unique(as_provider):
    assert as_provider.post("/api/days-off/", {"date": "2030-01-08"}, format="json").status_code == 201
    assert as_provider.post("/api/days-off/", {"date": "2030-01-08"}, format="json").status_code == 400


def test_service_with_bookings_is_deactivated(now, as_provider, client, service, customer, provider):
    book(service, customer, at(7, 10))
    assert as_provider.delete(f"/api/services/{service.id}/").status_code == 204
    service.refresh_from_db()
    assert service.is_active is False
    assert client.get(f"/api/providers/{provider.id}/").json()["services"] == []


def test_service_translations(as_provider):
    r = as_provider.post("/api/services/", {"name_tg": "Муоина", "name_ru": "Осмотр", "name_en": "Checkup",
                                             "duration_min": 30, "price": "10"}, format="json")
    assert r.status_code == 201, r.content
    sid = r.json()["id"]
    assert as_provider.get(f"/api/services/{sid}/", HTTP_ACCEPT_LANGUAGE="ru").json()["name"] == "Осмотр"
    r = as_provider.post("/api/services/", {"duration_min": 30, "price": "10"}, format="json")
    assert r.status_code == 400


@pytest.mark.parametrize("payload", [{"duration_min": 0}, {"duration_min": 10000}, {"price": "-1"}])
def test_service_validation(as_provider, payload):
    data = {"name": "X", "duration_min": 30, "price": "10", **payload}
    assert as_provider.post("/api/services/", data, format="json").status_code == 400


def test_provider_can_edit_capacity_and_specialty(as_provider, provider):
    r = as_provider.patch("/api/providers/me/", {"capacity": 3, "specialty_ru": "Терапевт"}, format="json")
    assert r.status_code == 200
    provider.refresh_from_db()
    assert provider.capacity == 3 and provider.specialty_ru == "Терапевт"


def test_error_format(client, as_customer):
    body = client.post("/api/auth/register/", {"username": ""}, format="json").json()
    assert set(body) == {"detail", "code", "errors"} and "username" in body["errors"] and body["detail"]
    body = client.get("/api/bookings/").json()
    assert body["code"] == "not_authenticated" and body["detail"]
    body = as_customer.get("/api/bookings/999/").json()
    assert body["code"] == "not_found"
    r = client.get("/api/nothing-here/")
    assert r.status_code == 404 and r.json()["code"] == "not_found"


def test_login_error_format(client, customer):
    body = client.post("/api/auth/login/", {"username": "cli", "password": "bad"}, format="json").json()
    assert body["code"] == "no_active_account" and body["detail"]


def test_login_is_throttled(client, customer, monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"auth": "3/min"})
    codes = [client.post("/api/auth/login/", {"username": "cli", "password": "bad"}).status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]


def test_register_provider_with_city(client, category):
    r = client.post("/api/auth/register/", {"username": "kh", "password": "secret123", "role": "provider",
                                            "category": category.id, "name": "Kh Clinic", "city": "khujand"})
    assert r.status_code == 201
    assert r.json()["user"]["provider_id"] == Provider.objects.get(user__username="kh").id
    assert Provider.objects.get(user__username="kh").city == "khujand"


def test_register_bad_phone(client):
    assert client.post("/api/auth/register/", {"username": "p", "password": "secret123", "phone": "abc"}).status_code == 400


@pytest.fixture
def catalog(now, category):
    barbers = Category.objects.create(name_en="Barber", name_ru="Барбер", name_tg="Сартарош", slug="barber")
    a = make_provider("a", category)
    a.distance_km, a.rating, a.city, a.specialty_ru = 3, 4.1, "khujand", "Стоматолог"
    a.save()
    b = make_provider("b", barbers, hours=((time(15), time(18)),))
    b.distance_km, b.rating = 1, 4.9
    b.save()
    c = make_provider("c", category)
    Service.objects.create(provider=a, name_en="Teeth", name_ru="Зубы", duration_min=60, price=100)
    Service.objects.create(provider=b, name_en="Haircut", name_ru="Стрижка", duration_min=60, price=50)
    return a, b, c


def names(client, **params):
    return [p["name"] for p in results(client.get("/api/providers/", params))]


def test_provider_list_ordering(client, catalog):
    assert names(client) == ["A", "B"]
    assert names(client, ordering="distance") == ["B", "A"]
    assert names(client, ordering="rating") == ["B", "A"]


def test_provider_list_filters(client, catalog):
    assert names(client, city="khujand") == ["A"]
    assert names(client, category="barber") == ["B"]
    assert names(client, search="стриж") == ["B"]
    assert names(client, search="стоматолог") == ["A"]
    assert names(client, search="сартарош") == ["B"]
    assert client.get("/api/providers/", {"city": "tashkent"}).status_code == 400


def test_provider_list_date_param(client, catalog):
    first = results(client.get("/api/providers/", {"date": "2030-01-10"}))[0]["next_slots"][0]
    assert first.startswith("2030-01-10T09:00")
    assert client.get("/api/providers/", {"date": "bad"}).status_code == 400


def test_provider_list_is_paginated(client, catalog):
    body = client.get("/api/providers/", {"page_size": 1}).json()
    assert body["count"] == 2 and len(body["results"]) == 1 and body["next"]


def count_queries(client, **params):
    cache.clear()
    with CaptureQueriesContext(connection) as ctx:
        assert client.get("/api/providers/", params).status_code == 200
    return len(ctx.captured_queries)


@pytest.mark.parametrize("ordering", ["earliest", "distance", "rating"])
def test_provider_list_query_count_is_constant(now, client, category, customer, ordering):
    def add(n, start):
        for i in range(start, start + n):
            p = make_provider(f"p{i}", category)
            s = Service.objects.create(provider=p, name="S", duration_min=60, price=10)
            book(s, customer, at(7, 9))
            DayOff.objects.create(provider=p, date=at(8, 0).date())

    add(3, 0)
    small = count_queries(client, ordering=ordering, page_size=100)
    add(30, 100)
    big = count_queries(client, ordering=ordering, page_size=100)
    assert small == big <= 7, (small, big)


def test_categories_query_count(client, category):
    for i in range(5):
        Category.objects.create(name=f"C{i}", slug=f"c{i}")
    with CaptureQueriesContext(connection) as ctx:
        client.get("/api/categories/")
    assert len(ctx.captured_queries) == 1


def test_provider_list_is_cached_and_invalidated(now, client, catalog, customer):
    count_queries(client)
    with CaptureQueriesContext(connection) as ctx:
        first = client.get("/api/providers/").json()
    assert len(ctx.captured_queries) == 0
    a = catalog[0]
    book(a.services.get(), customer, at(7, 9))
    second = client.get("/api/providers/").json()
    assert first["results"][0]["next_slots"][0] != second["results"][0]["next_slots"][0] or \
        first["results"][0]["id"] != second["results"][0]["id"]


def test_accept_language_and_lang_param(client, catalog):
    assert client.get("/api/categories/", HTTP_ACCEPT_LANGUAGE="ru").json()[-1]["name"] == "Барбер"
    assert client.get("/api/categories/", HTTP_ACCEPT_LANGUAGE="tg").json()[-1]["name"] == "Сартарош"
    assert client.get("/api/categories/", {"lang": "en"}, HTTP_ACCEPT_LANGUAGE="ru").json()[-1]["name"] == "Barber"
    r = client.get("/api/providers/", {"lang": "ru"})
    assert r["Content-Language"] == "ru"
    assert results(r)[0]["services"][0]["name"] == "Зубы"


def test_fallback_when_translation_missing(client, category):
    assert client.get("/api/categories/", HTTP_ACCEPT_LANGUAGE="en").json()[0]["name"] == category.name_tg


@pytest.mark.parametrize("lang,text", [
    ("ru", "прошлое"), ("tg", "гузашта"), ("en", "past"),
])
def test_error_messages_are_translated(now, as_customer, service, lang, text):
    now.set(at(7, 10, 30))
    r = as_customer.post("/api/bookings/", {"service": service.id, "start": at(7, 10).isoformat()}, format="json",
                         HTTP_ACCEPT_LANGUAGE=lang)
    assert text in r.json()["detail"].lower(), r.json()


@pytest.mark.parametrize("lang,text", [("ru", "обязательное"), ("tg", "ҳатмӣ"), ("en", "required")])
def test_builtin_messages_are_translated(client, lang, text):
    r = client.post("/api/auth/register/", {}, format="json", HTTP_ACCEPT_LANGUAGE=lang)
    assert text in r.json()["detail"].lower(), r.json()


@pytest.mark.parametrize("lang,text", [("ru", "учетн"), ("tg", "ҳисоб")])
def test_jwt_messages_are_translated(client, customer, lang, text):
    r = client.post("/api/auth/login/", {"username": "cli", "password": "bad"}, HTTP_ACCEPT_LANGUAGE=lang)
    assert text in r.json()["detail"].lower(), r.json()


def test_index_serves_react_app(client, settings, tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text('<div id="root"></div>')
    settings.FRONTEND_DIST = dist
    r = client.get("/")
    assert r.status_code == 200 and b'id="root"' in b"".join(r.streaming_content)
    settings.FRONTEND_DIST = tmp_path / "missing"
    assert client.get("/").status_code == 503


def test_distance_from_client_location(client, catalog):
    a, b, _c = catalog
    a.lat, a.lng = 40.2826, 69.6222
    a.save()
    b.lat, b.lng = 38.5598, 68.7870
    b.save()
    rows = results(client.get("/api/providers/", {"ordering": "distance", "lat": 38.56, "lng": 68.79}))
    assert [r["name"] for r in rows] == ["B", "A"]
    assert float(rows[0]["distance_km"]) < 1 and 190 < float(rows[1]["distance_km"]) < 220
    rows = results(client.get("/api/providers/", {"ordering": "distance", "lat": 40.28, "lng": 69.62}))
    assert [r["name"] for r in rows] == ["A", "B"]
    assert client.get("/api/providers/", {"lat": "x", "lng": "1"}).status_code == 400
