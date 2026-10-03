import random
from datetime import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from myapp.models import CITY_CENTERS, Category, Provider, Service, WorkingHours

User = get_user_model()

CATEGORIES = [
    ("doctor-clinics", "stethoscope", "from-primary to-primary-container",
     ("Духтурон ва клиникаҳо", "Врачи и клиники", "Doctors & Clinics"),
     ("180+ духтур", "180+ врачей", "180+ Doctors")),
    ("barber-styling", "content_cut", "from-secondary to-secondary-container",
     ("Сартарошӣ ва услуб", "Барберы и стилисты", "Barber & Styling"),
     ("95+ студия", "95+ студий", "95+ Studios")),
    ("legal-counsel", "gavel", "from-tertiary to-primary-container",
     ("Машварати ҳуқуқӣ", "Юридические услуги", "Legal Counsel"),
     ("64+ ширкат", "64+ компаний", "64+ Firms")),
    ("car-care", "local_car_wash", "from-tertiary-container to-primary",
     ("Нигоҳубини мошин", "Автомойка и детейлинг", "Car Care Spa"),
     ("42+ нуқта", "42+ боксов", "42+ Detailing Bays")),
    ("driving-instructors", "sports_score", "from-secondary-container to-secondary",
     ("Омӯзгорони ронандагӣ", "Автоинструкторы", "Driving Instructors"),
     ("38+ сертификатдор", "38+ с сертификатом", "38+ Certified")),
    ("private-tutors", "school", "from-primary to-tertiary",
     ("Репетиторҳо", "Репетиторы", "Private Tutors"),
     ("112+ омӯзгор", "112+ преподавателей", "112+ Mentors")),
]

PROVIDERS = [
    ("dr_alisher", "doctor-clinics", "Dr. Alisher Vahidov",
     ("Мутахассиси дандонпизишкӣ ва ортодонтия", "Стоматолог-ортодонт", "Dental & Orthodontics Specialist"),
     "dushanbe", "Rudaki Ave 45", "4.95", 318, "0.8", 1,
     [(("Дандонпизишкӣ ва ортодонтия", "Стоматология и ортодонтия", "Dental & Orthodontics"), 250, 45),
      (("Муоинаи ортодонтӣ", "Осмотр ортодонта", "Orthodontic Checkup"), 150, 45)]),
    ("royal_blade", "barber-styling", "The Royal Blade Studio",
     ("Устои сартарош ва ороиши анъанавӣ", "Мастер-барбер и классический груминг", "Master Barber & Traditional Grooming"),
     "dushanbe", "Ismoili Somoni Ave 12", "4.98", 420, "1.2", 1,
     [(("Сартарошии устоӣ", "Стрижка от мастера", "Master Barbering"), 80, 45),
      (("Ислоҳи риш ва фейд", "Стрижка бороды и фейд", "Beard Trim & Fade"), 60, 45)]),
    ("apex_legal", "legal-counsel", "Apex Legal Partners",
     ("Машварати корпоративӣ ва шаҳрвандӣ", "Корпоративное и гражданское право", "Corporate & Civil Law Advisors"),
     "khujand", "Lenin St 30", "4.92", 185, "2.1", 1,
     [(("Машварати ҳуқуқӣ", "Юридическая консультация", "Legal Consultation"), 300, 45),
      (("Тасдиқи шартнома", "Заверение договора", "Contract Notarization"), 200, 30)]),
    ("gloss_shield", "car-care", "Gloss & Shield Detailing",
     ("Шустушӯи керамикӣ ва тозакунии салон", "Керамическая мойка и химчистка салона", "Ceramic Wash & Interior Steam Spa"),
     "dushanbe", "Aini St 88", "4.91", 210, "1.8", 2,
     [(("Детейлинги керамикии экспресс", "Экспресс керамический детейлинг", "Express Ceramic Detailing"), 250, 75)]),
    ("horizon_driving", "driving-instructors", "Horizon Driving Academy",
     ("Омӯзгори сертификатдори категорияи B", "Сертифицированный инструктор категории B", "Category B Certified Instructor"),
     "bokhtar", "Vahdat St 7", "4.97", 290, "3.0", 1,
     [(("Дарси амалии ронандагӣ", "Практическое вождение", "Behind-the-Wheel Session"), 150, 90)]),
    ("cambridge_math", "private-tutors", "Cambridge Math Studio",
     ("Тайёрӣ ба олимпиада ва SAT", "Подготовка к олимпиадам и SAT", "Olympiad & SAT Foundation Prep"),
     "khujand", "Kamoli Khujandi St 15", "4.99", 350, "1.5", 1,
     [(("Машғулияти инфиродии математикаи олимпиадавӣ", "Индивидуальные занятия по олимпиадной математике",
        "1-on-1 Math Olympiad Coaching"), 120, 60),
      (("Тайёрӣ ба SAT (математика)", "Подготовка к SAT по математике", "SAT Math Prep"), 150, 60)]),
    ("dr_nigina", "doctor-clinics", "Dr. Nigina Rahimova",
     ("Духтури оилавӣ ва терапевт", "Семейный врач, терапевт", "Family Doctor & Therapist"),
     "khujand", "Sirdaryo St 3", "4.89", 142, "2.4", 1,
     [(("Муоинаи умумӣ", "Общий осмотр", "General Checkup"), 120, 30)]),
    ("sharq_barber", "barber-styling", "Sharq Barbershop",
     ("Мӯйсаргирии мардона ва кӯдакона", "Мужские и детские стрижки", "Men's & Kids Haircuts"),
     "bokhtar", "Navruz St 21", "4.85", 96, "1.1", 1,
     [(("Мӯйсаргирии мардона", "Мужская стрижка", "Men's Haircut"), 50, 30)]),
    ("pamir_lingua", "private-tutors", "Pamir Lingua Center",
     ("Забонҳои англисӣ ва русӣ, IELTS", "Английский и русский язык, IELTS", "English & Russian, IELTS Prep"),
     "dushanbe", "Bokhtar St 9", "4.93", 201, "2.7", 1,
     [(("Тайёрӣ ба IELTS", "Подготовка к IELTS", "IELTS Preparation"), 130, 60)]),
]


COORDS = {
    "dr_alisher": (38.5737, 68.7860), "royal_blade": (38.5810, 68.7700), "gloss_shield": (38.5520, 68.8010),
    "pamir_lingua": (38.5650, 68.7640), "apex_legal": (40.2850, 69.6200), "cambridge_math": (40.2780, 69.6310),
    "dr_nigina": (40.2905, 69.6095), "horizon_driving": (37.8372, 68.7795), "sharq_barber": (37.8318, 68.7860),
}


def tr(field, values):
    return {f"{field}_{lang}": v for lang, v in zip(("tg", "ru", "en"), values)}


class Command(BaseCommand):
    help = "Fill the database with demo data (tg / ru / en). Safe to run many times."

    def add_arguments(self, parser):
        parser.add_argument("--bench", type=int, default=0, help="also create N generated providers (for speed tests)")

    @transaction.atomic
    def handle(self, *args, bench=0, **opts):
        cats = {}
        for slug, icon, gradient, names, stats in CATEGORIES:
            cats[slug], _ = Category.objects.update_or_create(
                slug=slug, defaults={"icon": icon, "gradient": gradient, "name": names[2], "stats_label": stats[2],
                                     **tr("name", names), **tr("stats_label", stats)},
            )

        for (username, slug, name, spec, city, address, rating, reviews, km, cap, services) in PROVIDERS:
            p = self.provider(username, cats[slug], name, spec, city, address, rating, reviews, km, cap)
            for names, price, minutes in services:
                Service.objects.update_or_create(
                    provider=p, name_en=names[2],
                    defaults={"price": price, "duration_min": minutes, "name": names[2], **tr("name", names)},
                )

        for i in range(bench):
            username, slug, name, spec, city, address, rating, reviews, km, cap, services = random.choice(PROVIDERS)
            p = self.provider(f"bench_{i}", cats[slug], f"{name} #{i}", spec, random.choice(["dushanbe", "khujand", "bokhtar"]),
                              address, f"{random.uniform(4.5, 5):.2f}", random.randint(5, 500),
                              f"{random.uniform(0.2, 9.9):.1f}", cap)
            if not p.services.exists():
                Service.objects.bulk_create([
                    Service(provider=p, name=n[2], **tr("name", n), price=price, duration_min=m) for n, price, m in services
                ])

        client, created = User.objects.get_or_create(username="client", defaults={"role": "customer", "phone": "+992900000001"})
        if created:
            client.set_password("navbat123")
            client.save()
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@example.com", "admin12345")

        self.stdout.write(self.style.SUCCESS(
            "Seed done. Customer: client / navbat123 | Provider: dr_alisher / navbat123 | Admin: admin / admin12345"
            + (f" | +{bench} bench providers" if bench else "")
        ))

    def provider(self, username, category, name, spec, city, address, rating, reviews, km, cap):
        lat, lng = COORDS.get(username) or [c + random.uniform(-0.03, 0.03) for c in CITY_CENTERS[city]]
        user, created = User.objects.get_or_create(username=username, defaults={"role": "provider"})
        if created:
            user.set_password("navbat123")
            user.save()
        p, _ = Provider.objects.update_or_create(
            user=user,
            defaults=dict(category=category, name=name, specialty=spec[2], **tr("specialty", spec), city=city,
                          address=address, rating=rating, reviews_count=reviews, distance_km=km, capacity=cap,
                          lat=lat, lng=lng),
        )
        if not p.hours.exists():
            WorkingHours.objects.bulk_create(
                [WorkingHours(provider=p, weekday=d, start=time(9), end=time(20)) for d in range(6)]
            )
        return p
