from django.db import models
from django.contrib.auth.models import User

class EPS(models.Model):
    """Modelo de Entidad de Salud (EPS) - aseguradora"""
    nombre = models.CharField(max_length=150, unique=True)
    codigo = models.CharField(max_length=20, unique=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'eps'

    def __str__(self):
        return self.nombre


class Paciente(models.Model):
    """Modelo de Paciente"""
    TIPO_DOCUMENTO_CHOICES = [
        ('CC', 'Cédula de Ciudadanía'),
        ('TI', 'Tarjeta de Identidad'),
        ('CE', 'Cédula de Extranjería'),
        ('PASAPORTE', 'Pasaporte'),
    ]

    usuario = models.OneToOneField(User, on_delete=models.CASCADE)
    tipo_documento = models.CharField(max_length=20, choices=TIPO_DOCUMENTO_CHOICES)
    num_documento = models.CharField(max_length=30, unique=True)
    fecha_nacimiento = models.DateField()
    eps = models.ForeignKey(EPS, on_delete=models.SET_NULL, null=True)
    direccion = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'paciente'

    def __str__(self):
        return f"{self.usuario.first_name} {self.usuario.last_name}"