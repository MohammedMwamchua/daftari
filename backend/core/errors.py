from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class Conflict(APIException):
    """A business rule blocks the action. `code` is a stable key the screen can translate."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Not allowed.'

    def __init__(self, code, detail=None, **extra):
        super().__init__(detail or code)
        self.code = code
        self.extra = extra


def handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, Conflict):
        response.data = {'code': exc.code, 'detail': str(exc.detail), **exc.extra}
    elif isinstance(response.data, dict) and 'detail' not in response.data:
        response.data = {'code': 'invalid', 'detail': 'Invalid data.', 'errors': response.data}
    return response
