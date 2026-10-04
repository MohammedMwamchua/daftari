from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse
from django.urls import include, path, re_path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
]


if settings.FRONTEND_DIST:
    # WhiteNoise serves the built files; every other path is a screen in the React app.
    def frontend(request):
        return FileResponse(open(Path(settings.FRONTEND_DIST) / 'index.html', 'rb'), content_type='text/html')

    urlpatterns.append(re_path(r'^(?!api/|admin/|static/).*$', frontend))
