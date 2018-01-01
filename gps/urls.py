from django.conf.urls import url
from django.conf import settings
from django.conf.urls.static import static

from gps.views import home
from gps.views import BusquedaAjaxView

from . import views

app_name = 'front'


urlpatterns = [
	url(r'^$', home, name = 'home'),
	url(r'^busqueda_ajax/$', BusquedaAjaxView.as_view()),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)