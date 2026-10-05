from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path

urlpatterns = [path('api/', include('core.urls'))]
# The public demo publishes the manager's password, so it must not offer Django's all-powerful admin.
if not settings.DEMO_MODE:
    urlpatterns.append(path('admin/', admin.site.urls))


if settings.FRONTEND_DIST:
    # WhiteNoise serves the built files; every other path is a screen in the React app.
    from .csp import policy

    INDEX = (Path(settings.FRONTEND_DIST) / 'index.html').read_bytes()  # changes only with a new build, i.e. a restart

    def frontend(request):
        response = HttpResponse(INDEX, content_type='text/html')
        response['Content-Security-Policy'] = policy()
        return response

    urlpatterns.append(re_path(r'^(?!api/|admin/|static/).*$', frontend))
