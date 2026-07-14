from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from .models import Paciente, EPS, Cita


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
                  'num_documento', 'fecha_nacimiento', 'eps', 'direccion']

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


class CitaSerializer(serializers.ModelSerializer):
    """Serializer para listar citas del paciente"""
    medico_nombre = serializers.CharField(source='medico.usuario.get_full_name', read_only=True)
    especialidad_nombre = serializers.CharField(source='especialidad.nombre', read_only=True)
    
    class Meta:
        model = Cita
        fields = ['id', 'medico_nombre', 'especialidad_nombre', 'fecha_hora', 
                  'estado', 'motivo', 'creado_en', 'actualizado_en']
        read_only_fields = fields