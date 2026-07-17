from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Cita, Paciente, EPS, Especialidad, Medico, Administrativo
from .services import CitaService
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from .models import (
    Cita,
    Paciente,
    EPS,
    Especialidad,
    Medico,
    Administrativo,
    HorarioMedico,
    AlertaTopeEnviada,
    Sede,
    Feriado,
    ConfiguracionGlobal,
)


class PacienteRegistroSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    eps_id = serializers.IntegerField(required=True)
    # NOTA (conexion FE-BE): el frontend recoge nombres/apellidos en el
    # formulario de registro, pero antes se perdian porque no existian en
    # este serializer. Se agregan aqui como write-only y se mapean a
    # User.first_name/last_name en create().
    nombres = serializers.CharField(write_only=True, required=True, max_length=150)
    apellidos = serializers.CharField(write_only=True, required=True, max_length=150)
    # NOTA (conexion FE-BE): antes se descartaba porque el modelo Paciente no
    # tenía columna `telefono` (ver migración 0008). El formulario siempre
    # lo pide, así que aquí se acepta y se persiste.
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)

    class Meta:
        model = Paciente
        fields = ['email', 'password', 'password_confirm', 'nombres', 'apellidos',
                  'tipo_documento', 'num_documento', 'fecha_nacimiento', 'eps_id',
                  'direccion', 'telefono']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        
        if User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({"email": "Este email ya está registrado"})
        
        if Paciente.objects.filter(num_documento=data['num_documento']).exists():
            raise serializers.ValidationError({"num_documento": "Este documento ya está registrado"})
        
        return data

    def create(self, validated_data):
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        validated_data.pop('password_confirm')
        eps_id = validated_data.pop('eps_id')
        nombres = validated_data.pop('nombres')
        apellidos = validated_data.pop('apellidos')

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=nombres,
            last_name=apellidos,
        )

        eps = EPS.objects.get(id=eps_id)
        paciente = Paciente.objects.create(
            usuario=user,
            eps=eps,
            **validated_data
        )

        return paciente


def _documento_en_uso(num_documento):
    """True si `num_documento` ya está tomado por cualquier rol (Paciente,
    Medico o Administrativo). Usado por los tres *RegistroSerializer para
    que un mismo número de documento no pueda registrarse dos veces con
    roles distintos."""
    return (
        Paciente.objects.filter(num_documento=num_documento).exists()
        or Medico.objects.filter(num_documento=num_documento).exists()
        or Administrativo.objects.filter(num_documento=num_documento).exists()
    )


class MedicoRegistroSerializer(serializers.ModelSerializer):
    """
    NOTA (conexion FE-BE, punto 1): registro (autorregistro) de médico.

    A diferencia de Paciente, esta cuenta NO queda activa de inmediato:
    nace con estado='pendiente' y User.is_active=False hasta que un
    superadministrador la apruebe (ver views.AprobarSolicitudView), por eso
    este serializer no emite tokens JWT — la vista (views.registro_medico)
    solo confirma que la solicitud quedó registrada.

    `especialidad` se recibe como texto libre (así es como hoy la manda
    Register.jsx, tomada de una lista fija en el frontend) y se resuelve
    contra Especialidad por nombre sin distinguir mayúsculas/minúsculas; si
    no existe todavía, se crea (igual que agregarEspecialidadMock en el
    frontend permitía agregar especialidades sobre la marcha).
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    nombres = serializers.CharField(write_only=True, required=True, max_length=150)
    apellidos = serializers.CharField(write_only=True, required=True, max_length=150)
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)
    especialidad = serializers.CharField(write_only=True, required=True, max_length=100)

    class Meta:
        model = Medico
        fields = [
            'email', 'password', 'password_confirm', 'nombres', 'apellidos',
            'num_documento', 'telefono', 'especialidad', 'registro_medico',
        ]

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden'})

        if User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'Este email ya está registrado'})

        if _documento_en_uso(data['num_documento']):
            raise serializers.ValidationError({'num_documento': 'Este documento ya está registrado'})

        if Medico.objects.filter(registro_medico=data['registro_medico']).exists():
            raise serializers.ValidationError(
                {'registro_medico': 'Este número de registro médico ya está registrado'}
            )

        return data

    def create(self, validated_data):
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        validated_data.pop('password_confirm')
        nombres = validated_data.pop('nombres')
        apellidos = validated_data.pop('apellidos')
        especialidad_nombre = validated_data.pop('especialidad').strip()

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=nombres,
            last_name=apellidos,
            is_active=False,
        )

        especialidad, _created = Especialidad.objects.get_or_create(
            nombre__iexact=especialidad_nombre,
            defaults={'nombre': especialidad_nombre, 'descripcion': ''},
        )

        medico = Medico.objects.create(
            usuario=user,
            estado='pendiente',
            activo=False,
            **validated_data,
        )
        medico.especialidades.add(especialidad)

        return medico


class AdministrativoRegistroSerializer(serializers.ModelSerializer):
    """
    NOTA (conexion FE-BE, punto 1): registro (autorregistro) de personal
    administrativo. Igual que MedicoRegistroSerializer: la cuenta nace
    'pendiente' / User.is_active=False y no se emiten tokens hasta que un
    superadministrador la aprueba.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    nombres = serializers.CharField(write_only=True, required=True, max_length=150)
    apellidos = serializers.CharField(write_only=True, required=True, max_length=150)
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)

    class Meta:
        model = Administrativo
        fields = [
            'email', 'password', 'password_confirm', 'nombres', 'apellidos',
            'num_documento', 'telefono', 'cargo',
        ]
        extra_kwargs = {
            'cargo': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden'})

        if User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'Este email ya está registrado'})

        if _documento_en_uso(data['num_documento']):
            raise serializers.ValidationError({'num_documento': 'Este documento ya está registrado'})

        return data

    def create(self, validated_data):
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        validated_data.pop('password_confirm')
        nombres = validated_data.pop('nombres')
        apellidos = validated_data.pop('apellidos')

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=nombres,
            last_name=apellidos,
            is_active=False,
        )

        return Administrativo.objects.create(
            usuario=user,
            estado='pendiente',
            activo=False,
            **validated_data,
        )


class EPSSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura para el selector de EPS del registro."""

    class Meta:
        model = EPS
        fields = ['id', 'nombre', 'codigo', 'activo']
        read_only_fields = fields


def _rol_de_usuario(user):
    """Determina el rol de un django User para el objeto `user` que
    consume el frontend (paciente/medico/administrativo/superadministrador).

    NOTA (conexion FE-BE, punto 1): "administrativo" se resuelve por grupo
    Django / is_staff (asignado en views.AprobarSolicitudView al aprobar la
    solicitud), no por la sola existencia del registro Administrativo — así,
    una cuenta todavía "pendiente" (que además tiene is_active=False y por
    lo tanto ni siquiera puede loguearse) nunca se confunde con una
    aprobada. "medico" sigue resolviéndose por la existencia del registro
    Medico; igual que antes, una cuenta pendiente no puede llegar hasta acá
    porque el login la bloquea (User.is_active=False).
    """
    if user.is_superuser or user.groups.filter(name='superadministrador').exists():
        return 'superadministrador'
    if user.is_staff or user.groups.filter(name='administrativo').exists():
        return 'administrativo'
    if Paciente.objects.filter(usuario=user).exists():
        return 'paciente'
    if Medico.objects.filter(usuario=user).exists():
        return 'medico'
    return None


def _user_payload(user):
    """Arma el objeto `user` con la forma que espera el frontend
    (nombre, apellido, cedula, correo, rol, etc.) a partir de un django User.
    """
    payload = {
        'id': user.id,
        'nombre': user.first_name,
        'apellido': user.last_name,
        'correo': user.email,
        'rol': _rol_de_usuario(user),
    }

    paciente = Paciente.objects.filter(usuario=user).select_related('eps').first()
    if paciente:
        payload.update({
            'cedula': paciente.num_documento,
            'eps': paciente.eps.nombre if paciente.eps else None,
            'direccion': paciente.direccion,
            'telefono': paciente.telefono,
        })

    medico = Medico.objects.filter(usuario=user).first()
    if medico:
        payload.update({
            'cedula': medico.num_documento,
            'telefono': medico.telefono,
            'registro_medico': medico.registro_medico,
            'especialidades': list(medico.especialidades.values_list('nombre', flat=True)),
            'estado': medico.estado,
        })

    administrativo = Administrativo.objects.filter(usuario=user).first()
    if administrativo:
        payload.update({
            'cedula': administrativo.num_documento,
            'telefono': administrativo.telefono,
            'cargo': administrativo.cargo,
            'estado': administrativo.estado,
        })

    return payload


def _resolver_username_por_documento(documento):
    """Busca `documento` como num_documento de Paciente/Medico/Administrativo
    y devuelve el username (=email) del django User dueño de ese registro.

    NOTA (conexion FE-BE, punto 1): antes solo miraba Paciente, así que
    médicos y administrativos nunca podían loguearse con su cédula (que es
    lo único que el formulario de login envía, sin importar el rol — ver
    Login.jsx). None si no hay ningún registro con ese documento, en cuyo
    caso PacienteTokenSerializer deja pasar el valor tal cual (caso de
    superusuarios creados por `createsuperuser`).
    """
    for Modelo in (Paciente, Medico, Administrativo):
        registro = Modelo.objects.filter(num_documento=documento).select_related('usuario').first()
        if registro:
            return registro.usuario.username
    return None


class PacienteTokenSerializer(TokenObtainPairSerializer):
    """Serializer personalizado para login.

    El frontend (Login.jsx) siempre envía el número de documento (cédula)
    en el campo que aquí se recibe como `username` (nombre heredado de
    SimpleJWT), sin importar el rol. Como el django User real se crea con
    username=email (ver PacienteRegistroSerializer/MedicoRegistroSerializer/
    AdministrativoRegistroSerializer .create()), aquí se intenta resolver
    primero el documento contra Paciente/Medico/Administrativo.num_documento
    (ver _resolver_username_por_documento) y, si no existe, se deja pasar
    tal cual (para permitir login de superusuarios/staff creados por
    `createsuperuser` con su username real).

    Una cuenta médico/administrativo "pendiente de autorización" tiene
    User.is_active=False, así que aunque el documento resuelva bien, el
    login de todas formas falla acá (SimpleJWT usa authenticate(), que
    rechaza usuarios inactivos) con el mismo mensaje genérico de
    "credenciales inválidas" que usa el resto del login.
    """

    def validate(self, attrs):
        documento = attrs.get(self.username_field)
        if documento:
            username_real = _resolver_username_por_documento(documento)
            if username_real:
                attrs[self.username_field] = username_real

        data = super().validate(attrs)
        return {
            'access': data['access'],
            'refresh': data['refresh'],
            'user': _user_payload(self.user),
        }


class RecuperarContraseniaSerializer(serializers.Serializer):
    """Serializer para recuperar contraseña"""
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("Este email no está registrado")
        return value


class ResetContraseniaSerializer(serializers.Serializer):
    """Serializer para cambiar contraseña con token"""
    token = serializers.CharField()
    nueva_contrasena = serializers.CharField(write_only=True, min_length=8)
    nueva_contrasena_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        if data['nueva_contrasena'] != data['nueva_contrasena_confirm']:
            raise serializers.ValidationError("Las contraseñas no coinciden")
        return data


class PacientePerfilSerializer(serializers.ModelSerializer):
    """Serializer para ver y editar perfil del paciente"""
    email = serializers.SerializerMethodField()
    primer_nombre = serializers.SerializerMethodField()
    apellido = serializers.SerializerMethodField()

    class Meta:
        model = Paciente
        fields = ['id', 'email', 'primer_nombre', 'apellido', 'tipo_documento', 
                  'num_documento', 'fecha_nacimiento', 'eps', 'direccion', 'telefono']

    def get_email(self, obj):
        return obj.usuario.email
    
    def get_primer_nombre(self, obj):
        return obj.usuario.first_name
    
    def get_apellido(self, obj):
        return obj.usuario.last_name

    def update(self, instance, validated_data):
        """Actualizar perfil del paciente"""
        # Actualizar usuario
        if 'primer_nombre' in self.initial_data:
            instance.usuario.first_name = self.initial_data.get('primer_nombre', '')
        if 'apellido' in self.initial_data:
            instance.usuario.last_name = self.initial_data.get('apellido', '')
        instance.usuario.save()

        # Actualizar paciente
        for attr, value in validated_data.items():
            if hasattr(instance, attr):
                setattr(instance, attr, value)
        instance.save()
        
        return instance
    

class DisponibilidadSerializer(serializers.Serializer):
    """Serializer para retornar slots disponibles"""
    fecha_hora = serializers.DateTimeField()
    disponible = serializers.BooleanField()


class DisponibilidadFilterSerializer(serializers.Serializer):
    """Serializer para validar filtros de disponibilidad"""
    medico_id = serializers.IntegerField(required=False)
    especialidad_id = serializers.IntegerField(required=False)
    fecha_inicio = serializers.DateTimeField(required=True)
    fecha_fin = serializers.DateTimeField(required=True)
    duracion_minutos = serializers.IntegerField(default=30, required=False)


class CitaCancelacionSerializer(serializers.ModelSerializer):
    """Serializer para cancelar cita"""
    
    class Meta:
        model = Cita
        fields = ['id', 'estado', 'motivo', 'actualizado_en']
        read_only_fields = ['id', 'actualizado_en']


class CitaListSerializer(serializers.ModelSerializer):
    """Serializer para listar citas del paciente"""
    medico_nombre = serializers.CharField(source='medico.usuario.get_full_name', read_only=True)
    especialidad_nombre = serializers.CharField(source='especialidad.nombre', read_only=True)
    
    class Meta:
        model = Cita
        fields = ['id', 'medico_nombre', 'especialidad_nombre', 'fecha_hora', 
                  'estado', 'motivo', 'creado_en', 'actualizado_en']
        read_only_fields = fields

class EspecialidadSerializer(serializers.ModelSerializer):
    medico_ids = serializers.PrimaryKeyRelatedField(
        source='medicos',
        many=True,
        queryset=Medico.objects.all(),
        write_only=True,
        required=False,
    )
    medicos = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Especialidad
        fields = [
            'id',
            'nombre',
            'descripcion',
            'activo',
            'fecha_creacion',
            'fecha_actualizacion',
            'medico_ids',
            'medicos',
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion', 'medicos']
        extra_kwargs = {
            'nombre': {'required': True},
            'descripcion': {'required': True},
            'activo': {'required': True},
        }

    def get_medicos(self, obj):
        return [
            {
                'id': medico.id,
                'nombre': medico.usuario.first_name,
                'apellido': medico.usuario.last_name,
                'registro_medico': medico.registro_medico,
                'activo': medico.activo,
            }
            for medico in obj.medicos.select_related('usuario').all()
        ]

    def validate_nombre(self, value):
        queryset = Especialidad.objects.filter(nombre__iexact=value.strip())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Ya existe una especialidad con ese nombre.')
        return value.strip()

    def create(self, validated_data):
        medicos = validated_data.pop('medicos', [])
        especialidad = super().create(validated_data)
        if medicos:
            especialidad.medicos.set(medicos)
        return especialidad

    def update(self, instance, validated_data):
        medicos = validated_data.pop('medicos', None)
        especialidad = super().update(instance, validated_data)
        if medicos is not None:
            especialidad.medicos.set(medicos)
        return especialidad
    

class HorarioMedicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HorarioMedico
        fields = [
            "id",
            "medico",
            "dia_semana",
            "hora_inicio",
            "hora_fin",
            "max_citas_por_hora",
            "activo",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        medico = attrs.get("medico", getattr(self.instance, "medico", None))
        dia_semana = attrs.get("dia_semana", getattr(self.instance, "dia_semana", None))
        hora_inicio = attrs.get("hora_inicio", getattr(self.instance, "hora_inicio", None))
        hora_fin = attrs.get("hora_fin", getattr(self.instance, "hora_fin", None))

        # Validar que la hora inicial sea menor que la final
        if hora_inicio >= hora_fin:
            raise serializers.ValidationError({
                "hora_inicio": "La hora de inicio debe ser menor que la hora de fin."
            })

        # Buscar horarios que se crucen
        conflictos = HorarioMedico.objects.filter(
            medico=medico,
            dia_semana=dia_semana,
            activo=True,
            hora_inicio__lt=hora_fin,
            hora_fin__gt=hora_inicio,
        )

        # Si estamos editando, excluir el propio registro
        if self.instance:
            conflictos = conflictos.exclude(pk=self.instance.pk)

        if conflictos.exists():
            raise serializers.ValidationError({
                "horario": "Ya existe un horario que se solapa con este intervalo."
            })

        return attrs


class CitaSerializer(serializers.ModelSerializer):
    motivo_consulta = serializers.CharField(source='motivo', required=True)
    paciente_nombre = serializers.CharField(source='paciente.usuario.get_full_name', read_only=True)
    medico_nombre = serializers.CharField(source='medico.usuario.get_full_name', read_only=True)
    especialidad_nombre = serializers.CharField(source='especialidad.nombre', read_only=True)

    class Meta:
        model = Cita
        fields = [
            'id',
            'paciente',
            'medico',
            'especialidad',
            'fecha',
            'hora_inicio',
            'hora_fin',
            'eps',
            'motivo_consulta',
            'tipo_cita',
            'estado',
            'notificacion_encolada',
            'creado_en',
            'paciente_nombre',
            'medico_nombre',
            'especialidad_nombre',
        ]
        read_only_fields = ['id', 'estado', 'notificacion_encolada', 'creado_en']
        extra_kwargs = {
            'paciente': {'required': True},
            'medico': {'required': True},
            'especialidad': {'required': True},
            'fecha': {'required': True},
            'hora_inicio': {'required': True},
            'hora_fin': {'required': True},
            'eps': {'required': True},
            'tipo_cita': {'required': True},
        }

    def validate(self, attrs):
        errors, alerts = CitaService.validate_payload(attrs, lock=False)
        self.context['alerts'] = alerts
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        cita, alerts = CitaService.create_cita(validated_data)
        self.context['alerts'] = alerts
        return cita

class AgendaMedicoSerializer(serializers.ModelSerializer):
    medico_nombre = serializers.CharField(source="medico.usuario.get_full_name", read_only=True)
    especialidad_nombre = serializers.CharField(source="especialidad.nombre", read_only=True)
    paciente_nombre = serializers.CharField(source="paciente.usuario.get_full_name", read_only=True)

    class Meta:
        model = Cita
        fields = [
            "id",
            "fecha",
            "hora_inicio",
            "hora_fin",
            "estado",
            "motivo",
            "medico_nombre",
            "especialidad_nombre",
            "paciente_nombre",
        ]


class AlertaTopeEnviadaSerializer(serializers.ModelSerializer):
    """HU-022: alertas de tope EPS ya enviadas (para el panel de alertas)."""
    eps_nombre = serializers.CharField(source='eps.nombre', read_only=True)

    class Meta:
        model = AlertaTopeEnviada
        fields = [
            'id', 'eps', 'eps_nombre', 'periodo_inicio', 'periodo_fin',
            'porcentaje_uso', 'creado_en',
        ]
        read_only_fields = fields


class SedeSerializer(serializers.ModelSerializer):
    """HU-023: sedes de la institución."""

    class Meta:
        model = Sede
        fields = ['id', 'nombre', 'direccion', 'telefono', 'activo']


class FeriadoSerializer(serializers.ModelSerializer):
    """HU-023: días feriados institucionales."""

    class Meta:
        model = Feriado
        fields = ['id', 'fecha', 'descripcion']


class ConfiguracionGlobalSerializer(serializers.ModelSerializer):
    """HU-023: parámetros globales del sistema (tabla singleton)."""

    class Meta:
        model = ConfiguracionGlobal
        fields = [
            'horario_apertura',
            'horario_cierre',
            'anticipacion_minima_horas',
            'anticipacion_maxima_dias',
            'contacto_soporte_email',
            'actualizado_en',
        ]
        read_only_fields = ['actualizado_en']

    def validate(self, attrs):
        apertura = attrs.get('horario_apertura', getattr(self.instance, 'horario_apertura', None))
        cierre = attrs.get('horario_cierre', getattr(self.instance, 'horario_cierre', None))
        if apertura is not None and cierre is not None and apertura >= cierre:
            raise serializers.ValidationError(
                {'horario_apertura': 'El horario de apertura debe ser menor que el de cierre.'}
            )
        return attrs
