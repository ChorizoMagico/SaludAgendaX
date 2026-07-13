from rest_framework import serializers
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