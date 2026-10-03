from django.urls import path

from . import views as v
from .assistant import assistant
from .serializers import DayOffSerializer, ServiceSerializer, WorkingHoursSerializer

urlpatterns = [
    path("categories/", v.CategoryList.as_view()),
    path("cities/", v.cities),
    path("stats/", v.stats),
    path("assistant/", assistant),
    path("providers/", v.ProviderList.as_view()),
    path("providers/me/", v.ProviderMe.as_view()),
    path("providers/me/calendar-token/", v.ProviderMe.as_view()),
    path("providers/<int:pk>/", v.ProviderDetail.as_view()),
    path("providers/<int:pk>/slots/", v.ProviderSlots.as_view()),
    path("providers/<int:pk>/reviews/", v.ReviewList.as_view()),
    path("bookings/", v.BookingList.as_view()),
    path("bookings/<int:pk>/", v.BookingDetail.as_view()),
    path("bookings/<int:pk>/status/", v.BookingStatus.as_view()),
    path("bookings/<int:pk>/reschedule/", v.BookingReschedule.as_view()),
    path("bookings/<int:pk>/ics/", v.BookingIcs.as_view()),
    path("reviews/", v.ReviewList.as_view()),
    path("favorites/", v.FavoriteList.as_view()),
    path("favorites/<int:pk>/", v.FavoriteList.as_view()),
    path("calendar/<uuid:token>.ics", v.calendar_feed),
]
for name, serializer in [("services", ServiceSerializer), ("working-hours", WorkingHoursSerializer), ("days-off", DayOffSerializer)]:
    urlpatterns += [path(f"{name}/", v.OwnList.as_view(serializer_class=serializer)),
                    path(f"{name}/<int:pk>/", v.OwnDetail.as_view(serializer_class=serializer))]
