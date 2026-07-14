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
    
class Especialidad(models.Model):
    """Modelo de especialidad médica"""
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)

    class Meta:
        db_table = 'especialidad'
        verbose_name_plural = 'Especialidades'

    def __str__(self):
        return self.nombre

class Medico(models.Model):
    """Modelo de Médico"""
    usuario = models.OneToOneField(User, on_delete=models.CASCADE)
    especialidades = models.ManyToManyField(Especialidad, related_name='medicos')
    registro_medico = models.CharField(max_length=50, unique=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'medico'

    def __str__(self):
        return f"Dr. {self.usuario.last_name} - {self.usuario.first_name}"
    
class Cita(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
    ]

    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name='citas')

    medico = models.ForeignKey(Medico, on_delete=models.PROTECT)
    especialidad = models.ForeignKey(Especialidad, on_delete=models.PROTECT)
    
    fecha_hora = models.DateTimeField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    motivo = models.TextField(blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cita'
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"Cita {self.id} - {self.paciente} - {self.fecha_hora}"
    
class TopeEPS(models.Model):
    """Modelo para configurar límites de citas por EPS"""
    TIPO_PERIODO = [
        ('SEMANAL', 'Semanal'),
        ('MENSUAL', 'Mensual'),
    ]

    eps = models.OneToOneField(EPS, on_delete=models.CASCADE, related_name='tope')
    limite_citas = models.PositiveIntegerField(help_text="Número máximo de citas permitidas")
    tipo_periodo = models.CharField(max_length=10, choices=TIPO_PERIODO, default='MENSUAL')
    presupuesto_maximo = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'tope_eps'
        verbose_name_plural = 'Topes EPS'

    def __str__(self):
        return f"Tope para {self.eps.nombre}: {self.limite_citas} citas ({self.tipo_periodo})"