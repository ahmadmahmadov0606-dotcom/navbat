# Navbat — universal booking platform (Django + DRF + React)

One app for every service: doctor, barber, lawyer, car wash, driving school, tutor.
Every specialist creates a profile, sets working hours, clients book online.
Languages: **Tajik (tg, default), Russian (ru), English (en)**. Cities: Dushanbe, Khujand, Bokhtar. Prices in somoni (TJS).

## Quick start

Requirements: Python 3.12+, Node 20+.

```bash
./run.sh          # venv + packages + React build + migrate + seed + runserver on :8000
./run.sh 8001     # another port
```

Open http://localhost:8000 — the React app is served by Django.
Admin: http://localhost:8000/admin/ · API: http://localhost:8000/api/

Demo logins (created by `python manage.py seed`):

| Who      | Login                   |
|----------|-------------------------|
| Customer | `client` / `navbat123`  |
| Provider | `dr_alisher` / `navbat123` (also `royal_blade`, `cambridge_math`, …) |
| Admin    | `admin` / `admin12345`  |

### Frontend development (hot reload)

```bash
python manage.py runserver 8000                 # terminal 1
cd frontend && npm install && npm run dev       # terminal 2 -> http://localhost:5174 (proxies /api to :8000)
# other backend port: VITE_BACKEND=http://localhost:8001 npm run dev
cd frontend && npm run build                    # production build -> frontend/dist (Django serves it)
```

`frontend/design/index.html` is the original static design, kept as the visual reference.

## Tests

```bash
pip install -r requirements-dev.txt
pytest                         # ~100 tests: auth, slots, bookings (incl. race), reviews, permissions,
                               # validation, error format, pagination, throttling, cache, query count, i18n
pytest tests/test_slots.py -q  # one file
```

## Languages

- The API answers in the language from the `Accept-Language` header, or `?lang=tg|ru|en` (wins over the header).
  Default and fallback: `tg`.
- Error messages: `locale/tg` and `locale/ru` (`django.po`). After editing a `.po` file run
  `python manage.py compilemessages` (needs GNU gettext: `sudo apt install gettext`).
- Translatable data (django-modeltranslation): `Category.name`, `Category.stats_label`, `Provider.specialty`,
  `Service.name` → columns `*_tg`, `*_ru`, `*_en`. The admin shows all three. Search looks in all three.
- Frontend texts: `frontend/src/i18n/{tg,ru,en}.json`. Switcher in the header; the choice is kept in
  `localStorage`, default = browser language, fallback = `tg`. Dates, times and prices use the `Intl` API
  (browsers have no Tajik locale data, so `tg` dates and "смн" are formatted from the dictionary).

## Database schema

```
Category ──< Provider ──< Service
                 │
                 ├──< WorkingHours
                 ├──< DayOff
                 └──< Booking >── Service
                          │   └── Review (one per booking)
                        Customer (User)
```

- **Category** – kind of work (name*, slug, icon, gradient, stats_label*)
- **Provider** – specialist profile (user, category, name, specialty*, city, address, `extra` JSON, `capacity`, rating, reviews_count, distance_km, is_verified)
- **Service** – name*, duration_min (5–720), price (TJS), is_active
- **WorkingHours** – weekday + start/end (intervals of one weekday must not overlap)
- **DayOff** – a date when the provider does not work (unique per provider)
- **Booking** – provider, service, customer, start, end, status (`pending / confirmed / cancelled / done`)
- **Review** – booking (one-to-one), rating 1–5, comment. Allowed only after `done`.
  `Provider.rating` and `reviews_count` are recalculated automatically.

`*` = stored in tg / ru / en.

Free slots are **not stored**. They are calculated on request (`myapp/slots.py`):
working hours − days off − existing bookings, split by the service duration.
`capacity` lets a place (car wash, big studio) serve several clients at the same time.

## API

All errors have one shape: `{"detail": "<translated text>", "code": "<code>", "errors": {"field": ["..."]}}`
(`errors` only for validation errors). Lists marked *paged* return `{count, next, previous, results}`
(`?page=`, `?page_size=` up to 100).

| Method | URL | Notes |
|---|---|---|
| POST | `/api/auth/register/` | `username, password, phone?, first_name?`, `role` (`customer` / `provider`; provider also needs `category, name`, optional `address, city`). Throttled 10/min |
| POST | `/api/auth/login/` | returns `access`, `refresh` (JWT). Throttled 10/min |
| POST | `/api/auth/refresh/` | new `access` |
| GET/PATCH | `/api/auth/me/` | current user (+ `provider_id`) |
| GET | `/api/categories/` | cached |
| GET | `/api/cities/` | dushanbe / khujand / bokhtar |
| GET | `/api/providers/?category=&city=&search=&date=YYYY-MM-DD&ordering=earliest\|distance\|rating` | *paged*, cached; cards with `next_slots` (from `date`) |
| GET | `/api/providers/<id>/` | |
| GET | `/api/providers/<id>/slots/?date=YYYY-MM-DD&service=<id>` | free times (service = main service if empty) |
| GET | `/api/providers/<id>/reviews/` | *paged* |
| GET/PATCH | `/api/providers/me/` | my provider profile (+ `specialty_tg/ru/en`, `capacity`, `category_id`) |
| CRUD | `/api/services/`, `/api/working-hours/`, `/api/days-off/` | provider manages only his own rows. Deleting a service with bookings hides it (`is_active=false`) |
| GET | `/api/bookings/?status=pending,confirmed&date=&upcoming=1&ordering=start` | *paged*, my bookings (`?as=provider` — bookings made to me) |
| POST | `/api/bookings/` | `{ "service": 1, "start": "2026-10-01T10:00:00+05:00" }` |
| POST | `/api/bookings/<id>/status/` | `{ "status": "cancelled" }` — customer can only cancel an active booking, provider can set any status |
| GET/POST | `/api/reviews/?provider=<id>` | `{ "booking": 5, "rating": 5, "comment": "..." }` |

Send the token as `Authorization: Bearer <access>`.

Booking rules: not in the past, not your own service, not overlapping your other active bookings,
only a real free slot. Double booking is prevented: the provider row is locked inside a transaction
(PostgreSQL `SELECT … FOR UPDATE`; SQLite uses `IMMEDIATE` transactions).

## Speed

- `/api/providers/` loads providers, services, working hours, days off and bookings of the next 7 days in
  **a constant number of queries** (5–7, tested with 3 and 33 providers) and calculates slots in memory.
  With 109 providers: 12 cards ≈ 15–30 ms, 100 cards ≈ 50 ms, from cache ≈ 1–3 ms.
- Categories and provider lists are cached for 45 s (`CATALOG_CACHE_SECONDS`), per language and query.
  Any change of a category / provider / service / hours / day off / booking / review invalidates the cache
  (version key). Use Redis (`REDIS_URL`) when you run several gunicorn workers.
- Indexes: Booking(provider, start), Booking(customer, start), DayOff(provider, date), WorkingHours(provider, weekday).
- Frontend: Vite + React build, Tailwind compiled to one CSS file (≈6 KB gzip), hashed file names cached for
  a year and pre-compressed (brotli/gzip) by whitenoise, API responses gzip. Search is debounced; after an action
  only the changed card / row is updated. The provider dashboard is a separate lazy chunk.
- Debug: with `DEBUG=1` django-debug-toolbar (from `requirements-dev.txt`) shows SQL per request;
  `python manage.py seed --bench 100` adds 100 generated providers for load checks (use a separate
  DB: `SQLITE_PATH=/tmp/bench.sqlite3`).

## Project structure

- `core/` – `settings.py`, `urls.py`, `api.py` (pagination, `?lang=`, JSON errors)
- `accounts/` – custom `User` (`phone`, `role`): register / login / refresh / me / password
- `myapp/` – `models.py` (plain models), `serializers.py`, `views.py` (DRF generic views + free-slot calculation),
  `urls.py`, `admin.py` (+ tg/ru/en translation fields), `apps.py` (signals: rating, cache), `seed` command
- `locale/` – tg / ru translations of API messages
- `frontend/` – React app (`src/`), i18n dictionaries, `design/` (original static design)
- `tests/` – pytest-django tests

## Swagger

http://localhost:8000/api/docs/ — interactive API docs. Get a token with `POST /api/auth/login/`,
press **Authorize** and paste the `access` token (JWT Bearer). OpenAPI schema: `/api/schema/`.
