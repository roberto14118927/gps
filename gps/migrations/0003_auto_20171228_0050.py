# Generated by Django 2.0 on 2017-12-28 06:50

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gps', '0002_auto_20171228_0048'),
    ]

    operations = [
        migrations.AlterField(
            model_name='gpson',
            name='date_create',
            field=models.DateTimeField(auto_now_add=True),
        ),
    ]
