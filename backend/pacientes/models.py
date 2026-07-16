from datetime import time

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

    dias_entre_citas = models.PositiveIntegerField(
        default=7,
        help_text="Cantidad mínima de días entre citas de la misma especialidad para un paciente."
    )

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
    recordatorio_enviado = models.BooleanField(
        default=False,
        help_text="Indica si ya se encoló el recordatorio de 24h para esta cita."
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cita'
        ordering = ['-fecha_hora']
        indexes = [
            models.Index(fields=['medico', 'fecha', 'hora_inicio'], name='cita_med_fecha_inicio_idx'),
            models.Index(fields=['especialidad', 'fecha'], name='cita_esp_fecha_idx'),
            models.Index(fields=['eps', 'estado'], name='cita_eps_estado_idx'),
            models.Index(fields=['paciente', '-fecha_hora'], name='cita_paciente_fecha_idx'), # índice compuesto para optimización
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

    medico = models.ForeignKey(Medico, on_delete=models.CASCADE, related_name='excepciones_medicas')
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
        ('cancelacion_cita', 'Cancelación de cita'),
        ('reprogramacion_cita', 'Reprogramación de cita'),
        ('recordatorio_cita', 'Recordatorio de cita (24h)'),
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
        indexes = [
            models.Index(
                fields=['estado'], 
                name='notif_pendiente_idx',
                condition=models.Q(estado='pendiente') # Índice parcial para optimización
            )
        ]


class ExcepcionHorario(models.Model):
    TIPO_EXCEPCION = [('BLOQUEO', 'Bloqueo'), ('EXTRA', 'Horario Extra')]
    
    medico = models.ForeignKey('Medico', on_delete=models.CASCADE, related_name='excepciones_horario')
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    tipo = models.CharField(max_length=10, choices=TIPO_EXCEPCION)
    motivo = models.TextField(blank=True, null=True)

class AlertaTopeEnviada(models.Model):
    """Registro de alertas ya enviadas a superadmin (HU-022).

    Cuando el uso de un tope EPS llega al 80% se envía un correo al
    superadministrador. Este modelo evita reenviar la misma alerta muchas
    veces dentro del mismo período (semanal/mensual) para la misma EPS.
    """
    eps = models.ForeignKey(EPS, on_delete=models.CASCADE, related_name='alertas_tope')
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    porcentaje_uso = models.DecimalField(max_digits=5, decimal_places=2)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'alerta_tope_eps'
        constraints = [
            models.UniqueConstraint(
                fields=['eps', 'periodo_inicio'],
                name='alerta_tope_eps_periodo_unique',
            )
        ]
        ordering = ['-creado_en']

    def __str__(self):
        return f"Alerta {self.eps.nombre} ({self.periodo_inicio} a {self.periodo_fin}): {self.porcentaje_uso}%"


class Sede(models.Model):
    """Sede física de la institución (HU-023)."""
    nombre = models.CharField(max_length=150, unique=True)
    direccion = models.CharField(max_length=255, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'sede'
        verbose_name_plural = 'Sedes'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Feriado(models.Model):
    """Día feriado institucional en el que no se agendan citas (HU-023)."""
    fecha = models.DateField(unique=True)
    descripcion = models.CharField(max_length=150)

    class Meta:
        db_table = 'feriado'
        ordering = ['fecha']
        verbose_name_plural = 'Feriados'

    def __str__(self):
        return f"{self.fecha} - {self.descripcion}"


class ConfiguracionGlobal(models.Model):
    """Parámetros globales del sistema (HU-023).

    Tabla singleton: siempre se trabaja sobre la fila con pk=1
    (ver ConfiguracionGlobal.get_solo()).
    """
    horario_apertura = models.TimeField(default=time(7, 0))
    horario_cierre = models.TimeField(default=time(19, 0))
    anticipacion_minima_horas = models.PositiveIntegerField(
        default=1,
        help_text="Horas mínimas de anticipación requeridas para poder agendar una cita.",
    )
    anticipacion_maxima_dias = models.PositiveIntegerField(
        default=90,
        help_text="Días máximos hacia el futuro en los que se puede agendar una cita.",
    )
    contacto_soporte_email = models.EmailField(blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'configuracion_global'

    def __str__(self):
        return "Configuración global del sistema"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
