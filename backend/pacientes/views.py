from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView
from datetime import datetime

from .serializers import (
    PacienteRegistroSerializer, 
    PacienteTokenSerializer,
    RecuperarContraseniaSerializer, 
    ResetContraseniaSerializer,
    PacientePerfilSerializer,
    CitaCancelacionSerializer,
    CitaSerializer  
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
    from .models import Paciente
    
    try:
        paciente = Paciente.objects.get(usuario=request.user)
    except Paciente.DoesNotExist:
        return Response({
            'error': 'El usuario no tiene perfil de paciente'
        }, status=status.HTTP_404_NOT_FOUND)
    
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
    

@api_view(['GET'])
@permission_classes([AllowAny])
def disponibilidad_medica(request):
    """
    Endpoint para obtener slots disponibles de un médico
    
    GET /api/disponibilidad/?medico_id=1&fecha_inicio=2026-07-20T08:00:00&fecha_fin=2026-07-26T18:00:00
    
    Parámetros:
    - medico_id: ID del médico (requerido)
    - fecha_inicio: Fecha inicio (requerido)
    - fecha_fin: Fecha fin (requerido)
    - duracion_minutos: Duración de cita en minutos (default 30)
    """
    from .disponibilidad import calcular_slots_disponibles
    from .models import Medico
    
    # Validar parámetros
    medico_id = request.query_params.get('medico_id')
    fecha_inicio = request.query_params.get('fecha_inicio')
    fecha_fin = request.query_params.get('fecha_fin')
    duracion = request.query_params.get('duracion_minutos', 30)
    
    if not all([medico_id, fecha_inicio, fecha_fin]):
        return Response({
            'error': 'Parámetros requeridos: medico_id, fecha_inicio, fecha_fin'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        medico = Medico.objects.get(id=medico_id)
    except Medico.DoesNotExist:
        return Response({
            'error': 'Médico no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        fecha_inicio_dt = datetime.fromisoformat(fecha_inicio)
        fecha_fin_dt = datetime.fromisoformat(fecha_fin)
    except ValueError:
        return Response({
            'error': 'Formato de fecha inválido. Usa ISO format: 2026-07-20T08:00:00'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Calcular slots
    slots = calcular_slots_disponibles(medico, fecha_inicio_dt, fecha_fin_dt, int(duracion))
    
    return Response({
        'medico': {
            'id': medico.id,
            'nombre': str(medico)
        },
        'fecha_inicio': fecha_inicio,
        'fecha_fin': fecha_fin,
        'duracion_minutos': duracion,
        'slots_disponibles': slots,
        'total_slots': len(slots)
    }, status=status.HTTP_200_OK)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def cancelar_cita(request, cita_id):
    """
    Cancelar una cita existente
    
    PATCH /api/citas/:id/cancelar/
    
    Body (opcional):
    {
        "motivo_cancelacion": "Tengo que viajar"
    }
    """
    from .models import Cita, Paciente
    
    try:
        cita = Cita.objects.get(id=cita_id)
    except Cita.DoesNotExist:
        return Response({
            'error': 'Cita no encontrada'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Verificar permisos: solo el paciente propietario puede cancelar
    try:
        paciente = Paciente.objects.get(usuario=request.user)
        if cita.paciente != paciente:
            return Response({
                'error': 'No tienes permiso para cancelar esta cita'
            }, status=status.HTTP_403_FORBIDDEN)
    except Paciente.DoesNotExist:
        return Response({
            'error': 'Usuario no es paciente'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Verificar que no esté ya cancelada
    if cita.estado == 'CANCELADA':
        return Response({
            'error': 'Esta cita ya ha sido cancelada'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Cancelar cita
    cita.estado = 'CANCELADA'
    cita.motivo = request.data.get('motivo_cancelacion', 'Cancelación solicitada por paciente')
    cita.save()
    
    serializer = CitaCancelacionSerializer(cita)
    return Response({
        'mensaje': 'Cita cancelada exitosamente',
        'cita': serializer.data
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historial_citas_paciente(request):
    """
    Obtener historial de citas del paciente autenticado
    
    GET /api/citas/historial/
    
    Parámetros de query (opcionales):
    - page: número de página (default 1)
    - estado: filtrar por estado (PENDIENTE, CONFIRMADA, CANCELADA)
    """
    from .models import Paciente, Cita
    from rest_framework.pagination import PageNumberPagination
    
    try:
        paciente = Paciente.objects.get(usuario=request.user)
    except Paciente.DoesNotExist:
        return Response({
            'error': 'Usuario no es paciente'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Obtener citas del paciente
    citas = Cita.objects.filter(paciente=paciente).order_by('-fecha_hora')
    
    # Filtrar por estado si se proporciona
    estado_filter = request.query_params.get('estado')
    if estado_filter:
        citas = citas.filter(estado=estado_filter)
    
    # Paginar
    paginator = PageNumberPagination()
    paginator.page_size = 10
    paginated_citas = paginator.paginate_queryset(citas, request)
    
    serializer = CitaSerializer(paginated_citas, many=True)
    
    return paginator.get_paginated_response({
        'paciente': {
            'id': paciente.id,
            'nombre': paciente.usuario.get_full_name() or paciente.usuario.email
        },
        'citas': serializer.data
    })