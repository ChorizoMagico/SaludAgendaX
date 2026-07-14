from django.db import models
from django.contrib.auth.models import User
from django.db.models.functions import Lower

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
    descripcion = models.TextField()
    activo = models.BooleanField(default=True)
    capacidad_diaria = models.PositiveIntegerField(default=50)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'especialidad'
        verbose_name_plural = 'Especialidades'
        constraints = [
            models.UniqueConstraint(
                Lower('nombre'),
                name='especialidad_nombre_ci_unique',
            ),
        ]

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
    fecha = models.DateField(null=True, blank=True)
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    eps = models.ForeignKey(EPS, on_delete=models.PROTECT, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    motivo = models.TextField(blank=True, null=True)
    tipo_cita = models.CharField(max_length=30, default='consulta_general')
    notificacion_encolada = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cita'
        ordering = ['-fecha_hora']
        indexes = [
            models.Index(fields=['medico', 'fecha', 'hora_inicio'], name='cita_med_fecha_inicio_idx'),
            models.Index(fields=['especialidad', 'fecha'], name='cita_esp_fecha_idx'),
            models.Index(fields=['eps', 'estado'], name='cita_eps_estado_idx'),
        ]

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


class HorarioMedico(models.Model):
    """Ventanas semanales de atención del médico."""

    DIA_SEMANA = [
        (0, 'Lunes'),
        (1, 'Martes'),
        (2, 'Miércoles'),
        (3, 'Jueves'),
        (4, 'Viernes'),
        (5, 'Sábado'),
        (6, 'Domingo'),
    ]

    medico = models.ForeignKey(Medico, on_delete=models.CASCADE, related_name='horarios')
    dia_semana = models.PositiveSmallIntegerField(choices=DIA_SEMANA)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    max_citas_por_hora = models.PositiveIntegerField(default=4)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'horario_medico'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(hora_inicio__lt=models.F('hora_fin')),
                name='horario_medico_inicio_lt_fin',
            ),
        ]


class ExcepcionMedico(models.Model):
    """Bloqueos de agenda del médico por permisos, vacaciones u otras novedades."""

    medico = models.ForeignKey(Medico, on_delete=models.CASCADE, related_name='excepciones')
    fecha = models.DateField()
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    motivo = models.CharField(max_length=255, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'excepcion_medico'


class NotificacionPendiente(models.Model):
    """Registro de notificaciones encoladas para procesamiento asíncrono."""

    TIPO_CHOICES = [
        ('confirmacion_cita', 'Confirmación de cita'),
    ]
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('procesando', 'Procesando'),
        ('enviada', 'Enviada'),
        ('fallida', 'Fallida'),
    ]

    tipo = models.CharField(max_length=50, choices=TIPO_CHOICES)
    cita = models.ForeignKey(Cita, on_delete=models.CASCADE, related_name='notificaciones')
    payload = models.JSONField(default=dict)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notificacion_pendiente'