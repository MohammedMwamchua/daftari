"""Checks each request's sign-in token. Kept apart from the login views because DRF loads this class while it is
still starting up, before its views can be imported."""
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

STAMP_CLAIM = 'pws'


def password_stamp(user):
    """Changes whenever the password changes. Keyed with SECRET_KEY, so it reveals nothing about the password."""
    return salted_hmac('daftari.password-stamp', user.password).hexdigest()[:20]


def stamp_matches(token, user):
    return user is not None and constant_time_compare(str(token.get(STAMP_CLAIM, '')), password_stamp(user))


class Authentication(JWTAuthentication):
    """The normal token check, plus: a token issued before the last password change is refused."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not stamp_matches(validated_token, user):
            raise AuthenticationFailed('Signed out: the password was changed.', code='password_changed')
        return user
