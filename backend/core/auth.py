"""Sign-in: tokens that stop working when the password changes, refresh tokens that work only once, sign-out,
and a login that resists password guessing. (The per-request token check is in authentication.py.)"""
import hashlib

from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .authentication import STAMP_CLAIM, password_stamp, stamp_matches


def tokens_for(user):
    """A fresh access/refresh pair, as the login returns."""
    refresh = LoginSerializer.get_token(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token[STAMP_CLAIM] = password_stamp(user)  # copied into every access token made from this refresh token
        return token


class RefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        token = RefreshToken(attrs['refresh'])  # raises TokenError if forged, expired or already used
        user = get_user_model().objects.filter(**{api_settings.USER_ID_FIELD: token.get(api_settings.USER_ID_CLAIM)}).first()
        if not stamp_matches(token, user):
            raise InvalidToken('Signed out: the password was changed.')
        return super().validate(attrs)


class LoginRateThrottle(AnonRateThrottle):
    """Password guessing from one device."""
    scope = 'login'
    rate = '10/min'


class LoginUserThrottle(SimpleRateThrottle):
    """Password guessing at one account from many devices."""
    scope = 'login-user'
    rate = '30/hour'

    def get_cache_key(self, request, view):
        name = str(request.data.get('username', '') if hasattr(request.data, 'get') else '').strip().lower()
        ident = hashlib.sha256(name.encode()).hexdigest() if name else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [LoginRateThrottle, LoginUserThrottle]


class RefreshView(TokenRefreshView):
    serializer_class = RefreshSerializer


class LogoutView(APIView):
    """Ends this sign-in for good: its refresh token can no longer be used. Works even after the access token expired."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            RefreshToken(str(request.data.get('refresh', ''))).blacklist()
        except TokenError:
            pass  # already expired, already used, or not a token: either way it is no good any more
        return Response(status=204)
