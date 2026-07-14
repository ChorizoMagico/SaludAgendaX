from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Cita, Paciente, EPS, Especialidad, Medico
from .services import CitaService
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class PacienteRegistroSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    eps_id = serializers.IntegerField(required=True)

    class Meta:
        model = Paciente
        fields = ['email', 'password', 'password_confirm', 'tipo_documento', 
                  'num_documento', 'fecha_nacimiento', 'eps_id', 'direccion']

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

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name='',
            last_name=''
        )

        eps = EPS.objects.get(id=eps_id)
        paciente = Paciente.objects.create(
            usuario=user,
            eps=eps,
            **validated_data
        )

        return paciente
    
class PacienteTokenSerializer(TokenObtainPairSerializer):
    """Serializer personalizado para login"""
    
    def validate(self, attrs):
        data = super().validate(attrs)
        return {
            'access': data['access'],
            'refresh': data['refresh'],
            'user_id': self.user.id,
            'email': self.user.email,
        }


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


class CitaSerializer(serializers.ModelSerializer):
    motivo_consulta = serializers.CharField(source='motivo', required=True)

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