from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from .models import Paciente, EPS


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
    email = serializers.CharField(source='usuario.email', read_only=True)
    primer_nombre = serializers.CharField(source='usuario.first_name')
    apellido = serializers.CharField(source='usuario.last_name')

    class Meta:
        model = Paciente
        fields = ['id', 'email', 'primer_nombre', 'apellido', 'tipo_documento', 
                  'num_documento', 'fecha_nacimiento', 'eps', 'direccion']

    def update(self, instance, validated_data):
        """Actualizar perfil del paciente"""
        usuario_data = validated_data.pop('usuario', {})
        
        if usuario_data:
            instance.usuario.first_name = usuario_data.get('first_name', instance.usuario.first_name)
            instance.usuario.last_name = usuario_data.get('last_name', instance.usuario.last_name)
            instance.usuario.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance