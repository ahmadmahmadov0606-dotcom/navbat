from django.contrib.auth import login
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import LoginSerializer, PasswordSerializer, RegisterSerializer, UserSerializer

LIMITED = {"throttle_classes": [ScopedRateThrottle], "throttle_scope": "auth"}


def tokens(user):
    t = RefreshToken.for_user(user)
    return {"access": str(t.access_token), "refresh": str(t)}


class RegisterView(generics.CreateAPIView):
    serializer_class, permission_classes = RegisterSerializer, [permissions.AllowAny]
    throttle_classes, throttle_scope = LIMITED.values()

    def perform_create(self, serializer):
        self.user = serializer.save()

    def create(self, request, *args, **kwargs):
        super().create(request, *args, **kwargs)
        return Response({"user": UserSerializer(self.user).data, **tokens(self.user)}, status=201)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class, permission_classes = UserSerializer, [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PasswordView(generics.GenericAPIView):

    serializer_class, permission_classes = PasswordSerializer, [permissions.IsAuthenticated]
    throttle_classes, throttle_scope = LIMITED.values()

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response(tokens(request.user))


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes, throttle_scope = LIMITED.values()

    def post(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        try:
            s.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        if s.validated_data["role"] == "admin":
            login(request._request, s.user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(s.validated_data)


RefreshView = TokenRefreshView
