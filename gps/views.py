from django.shortcuts import render
from django.views.generic import TemplateView
from gps.models import Gpsus
from gps.models import Gpsub
from django.http import HttpResponse

# Create your views here.
from django.core import serializers
class BusquedaAjaxView(TemplateView):
	def get(self, request, *args, **kwargs):
		imei_get = request.GET['imei']
		datosout = Gpsub.objects.filter(imei__exact = imei_get).order_by('-date_create')
		data = serializers.serialize('json',datosout, 
			fields=('imei', 'latit', 'longi', 'combu','date_create'))
		return HttpResponse(data, content_type='application/json')


def home(request):
	gpsus = Gpsus.objects.all()
	context ={
		'gpsus': gpsus
	}
	return render(request,'front/home.html',context)