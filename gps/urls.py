from django.conf.urls import url
from django.conf import settings
from django.conf.urls.static import static

from gps.views import home

from . import views

app_name = 'front'


urlpatterns = [
	url(r'^$', home, name = 'home'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)