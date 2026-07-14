from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    PacienteRegistroSerializer, 
    PacienteTokenSerializer,
    RecuperarContraseniaSerializer, 
    ResetContraseniaSerializer,
    PacientePerfilSerializer
)
from .utils import generar_token_recuperacion, verificar_token, enviar_email_recuperacion


@api_view(['POST'])
def registro_paciente(request):
    """
    Endpoint para registrar un nuevo paciente
    POST /api/pacientes/registro
    """
    serializer = PacienteRegistroSerializer(data=request.data)
    
    if serializer.is_valid():
        paciente = serializer.save()
        return Response({
            'mensaje': 'Registro exitoso',
            'paciente_id': paciente.id,
            'email': paciente.usuario.email
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PacienteLoginView(TokenObtainPairView):
    """
    Endpoint de login para pacientes
    POST /api/pacientes/login
    
    Body:
    {
        "username": "juan@gmail.com",
        "password": "Password123"
    }
    """
    serializer_class = PacienteTokenSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def recuperar_contrasena(request):
    """
    Endpoint para solicitar recuperación de contraseña
    POST /api/pacientes/recuperar-contrasena/
    
    Body:
    {
        "email": "juan@gmail.com"
    }
    """
    serializer = RecuperarContraseniaSerializer(data=request.data)
    
    if serializer.is_valid():
        email = serializer.validated_data['email']
        user = User.objects.get(email=email)
        uidb64, token = generar_token_recuperacion(user)
        enviar_email_recuperacion(user, uidb64, token)
        
        return Response({
            'mensaje': 'Email de recuperación enviado. Revisa tu correo.',
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_contrasena(request):
    """
    Endpoint para cambiar contraseña
    POST /api/pacientes/reset-contrasena/
    
    Body:
    {
        "token": "token_del_email",
        "uidb64": "uidb64_del_email",
        "nueva_contrasena": "NuevaPass123",
        "nueva_contrasena_confirm": "NuevaPass123"
    }
    """
    serializer = ResetContraseniaSerializer(data=request.data)
    
    if serializer.is_valid():
        uidb64 = request.data.get('uidb64')
        token = request.data.get('token')
        
        user = verificar_token(uidb64, token)
        
        if not user:
            return Response({
                'error': 'Token inválido o expirado'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(serializer.validated_data['nueva_contrasena'])
        user.save()
        
        return Response({
            'mensaje': 'Contraseña cambiada exitosamente'
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def perfil_paciente(request):
    """
    GET: Ver el perfil del paciente autenticado
    PUT: Editar el perfil del paciente
    
    GET /api/pacientes/perfil/
    
    PUT /api/pacientes/perfil/
    Body:
    {
        "usuario": {
            "first_name": "Juan",
            "last_name": "García"
        },
        "tipo_documento": "CC",
        "num_documento": "123456789",
        "fecha_nacimiento": "2000-05-15",
        "eps": 1,
        "direccion": "Cra 5 #10-50"
    }
    """
    try:
        paciente = request.user.paciente
    except:
        return Response({
            'error': 'El usuario no tiene perfil de paciente'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if request.method == 'GET':
        serializer = PacientePerfilSerializer(paciente)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        serializer = PacientePerfilSerializer(paciente, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'mensaje': 'Perfil actualizado exitosamente',
                'paciente': serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)