from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.forms import DecimalField
from django.db import models
import datetime

# Create your models here.
class Gpsusuario(models.Model):
	id_gpsu = models.AutoField(primary_key = True)
	id_user = models.IntegerField(null=True, default=0)
	imei = models.CharField(max_length=255, blank=True, null=True)
	cmp_nombre = models.CharField(max_length=255, blank=True, null=True)
	cmp_unidad = models.CharField(max_length=255, blank=True, null=True)
	date_create = models.DateTimeField(default=datetime.date.today)

	def __str__(self):
		return self.imei

class Gpson(models.Model):
	id_gps = models.AutoField(primary_key = True)
	id_user = models.ForeignKey(Gpsusuario)
	imei = models.CharField(max_length=255, blank=True, null=True)
	date_create = models.DateTimeField(default=datetime.date.today)

	def __str__(self):
		return self.imei


