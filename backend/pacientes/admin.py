from django.contrib import admin
from .models import Paciente, EPS, Especialidad, Medico, Cita, TopeEPS


# Register your models here.

admin.site.register(Paciente)
admin.site.register(EPS)
admin.site.register(Especialidad)
admin.site.register(Medico)
admin.site.register(Cita)
admin.site.register(TopeEPS)
