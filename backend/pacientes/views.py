from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView
from datetime import datetime, timedelta
from datetime import datetime, timedelta
from rest_framework.permissions import IsAdminUser
from django.utils import timezone
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.db import transaction
from django.db import transaction


from .serializers import (
    PacienteRegistroSerializer, 
    PacienteTokenSerializer,
    RecuperarContraseniaSerializer, 
    ResetContraseniaSerializer,
    PacientePerfilSerializer,
    CitaSerializer,
    CitaCancelacionSerializer,
    CitaListSerializer,
    HorarioMedicoSerializer,
    AgendaMedicoSerializer,
    AlertaTopeEnviadaSerializer,
    SedeSerializer,
    FeriadoSerializer,
    ConfiguracionGlobalSerializer,
)

from .utils import generar_token_recuperacion, verificar_token, enviar_email_recuperacion
from .serializers import PacienteTokenSerializer, EspecialidadSerializer, CitaSerializer
from .models import Cita, Especialidad, Paciente, Medico, HorarioMedico, AlertaTopeEnviada, Sede, Feriado, ConfiguracionGlobal
from .services import CitaService
from .permissions import IsAdministrativeOrAuthenticatedPatient, IsAdministrativeUser, IsSuperAdministrativeUser
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import permission_classes
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count

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
        paciente = Paciente.objects.select_related('usuario', 'eps').get(usuario=request.user) #optimizado
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
    with transaction.atomic():
        cita.estado = 'CANCELADA'
        cita.motivo = request.data.get('motivo_cancelacion', 'Cancelación solicitada por paciente')
        cita.save()
        transaction.on_commit(lambda: CitaService.enqueue_cancelacion_notification(cita.id))

    with transaction.atomic():
        cita.estado = 'CANCELADA'
        cita.motivo = request.data.get('motivo_cancelacion', 'Cancelación solicitada por paciente')
        cita.save()
        transaction.on_commit(lambda: CitaService.enqueue_cancelacion_notification(cita.id))

    serializer = CitaCancelacionSerializer(cita)
    return Response({
        'mensaje': 'Cita cancelada exitosamente',
        'cita': serializer.data
    }, status=status.HTTP_200_OK)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def reprogramar_cita(request, cita_id):
    """
    Reprograma (cambia fecha/hora de) una cita existente.

    PATCH /api/citas/:id/reprogramar/

    Body:
    {
        "fecha": "2026-07-25",
        "hora_inicio": "10:00:00",
        "hora_fin": "10:30:00"
    }

    Solo el paciente propietario o un usuario administrativo pueden reprogramar.
    Se valida contra las mismas reglas de negocio que la creación de citas
    (disponibilidad del médico, tope EPS, frecuencia, etc.), excluyendo la
    propia cita de los chequeos de conflicto.
    """
    try:
        cita = Cita.objects.select_related('paciente__usuario', 'medico').get(id=cita_id)
    except Cita.DoesNotExist:
        return Response({'error': 'Cita no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    if not IsAdministrativeUser.is_admin_user(request.user):
        try:
            paciente = Paciente.objects.get(usuario=request.user)
        except Paciente.DoesNotExist:
            return Response({'error': 'Usuario no es paciente'}, status=status.HTTP_403_FORBIDDEN)
        if cita.paciente != paciente:
            return Response(
                {'error': 'No tienes permiso para reprogramar esta cita'},
                status=status.HTTP_403_FORBIDDEN,
            )

    fecha_raw = request.data.get('fecha')
    hora_inicio_raw = request.data.get('hora_inicio')
    hora_fin_raw = request.data.get('hora_fin')

    if not all([fecha_raw, hora_inicio_raw, hora_fin_raw]):
        return Response(
            {'error': 'Se requieren los campos fecha, hora_inicio y hora_fin'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        nueva_fecha = datetime.strptime(fecha_raw, '%Y-%m-%d').date()
        nueva_hora_inicio = datetime.strptime(hora_inicio_raw, '%H:%M:%S').time()
        nueva_hora_fin = datetime.strptime(hora_fin_raw, '%H:%M:%S').time()
    except ValueError:
        return Response(
            {'error': 'Formato inválido. fecha=YYYY-MM-DD, hora_inicio/hora_fin=HH:MM:SS'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        cita_actualizada, alerts = CitaService.reprogramar_cita(
            cita, nueva_fecha, nueva_hora_inicio, nueva_hora_fin
        )
    except serializers.ValidationError as exc:
        return Response(
            {
                'status': 'error',
                'code': 400,
                'message': 'No es posible reprogramar la cita',
                'errors': exc.detail,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = CitaListSerializer(cita_actualizada)
    return Response({
        'mensaje': 'Cita reprogramada exitosamente',
        'cita': serializer.data,
        'alertas': alerts,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calendario_citas(request):
    """
    Calendario de citas con vistas diaria, semanal y mensual (HU-011).

    GET /api/calendario/?vista=diaria&fecha=2026-07-20&medico_id=1&especialidad_id=2&estado=CONFIRMADA

    Parámetros (todos opcionales salvo lo indicado):
    - vista: 'diaria' (default), 'semanal' o 'mensual'
    - fecha: fecha de referencia, default hoy (YYYY-MM-DD)
    - medico_id: filtrar por médico
    - especialidad_id: filtrar por especialidad
    - estado: PENDIENTE, CONFIRMADA o CANCELADA

    Nota: el modelo actual no tiene un concepto de "sede", por lo que ese
    filtro (mencionado en la especificación) no está implementado todavía.

    Visibilidad:
    - Administrativo/superadmin: ve todas las citas.
    - Médico: ve solo su propia agenda.
    - Paciente: ve solo sus propias citas.
    """
    vista = request.query_params.get('vista', 'diaria')
    if vista not in ('diaria', 'semanal', 'mensual'):
        return Response(
            {'error': "El parámetro 'vista' debe ser 'diaria', 'semanal' o 'mensual'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    fecha_raw = request.query_params.get('fecha')
    try:
        fecha_referencia = (
            datetime.strptime(fecha_raw, '%Y-%m-%d').date() if fecha_raw else timezone.localdate()
        )
    except ValueError:
        return Response({'error': 'Formato de fecha inválido. Usa YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

    if vista == 'diaria':
        fecha_inicio_rango = fecha_referencia
        fecha_fin_rango = fecha_referencia
    elif vista == 'semanal':
        fecha_inicio_rango = fecha_referencia - timedelta(days=fecha_referencia.weekday())
        fecha_fin_rango = fecha_inicio_rango + timedelta(days=6)
    else:  # mensual
        fecha_inicio_rango = fecha_referencia.replace(day=1)
        if fecha_referencia.month == 12:
            fecha_fin_rango = fecha_referencia.replace(year=fecha_referencia.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            fecha_fin_rango = fecha_referencia.replace(month=fecha_referencia.month + 1, day=1) - timedelta(days=1)

    citas = Cita.objects.select_related(
        'paciente', 'paciente__usuario', 'medico', 'medico__usuario', 'especialidad', 'eps'
    ).filter(fecha__gte=fecha_inicio_rango, fecha__lte=fecha_fin_rango)

    es_admin = IsAdministrativeUser.is_admin_user(request.user)
    if not es_admin:
        medico_propio = Medico.objects.filter(usuario=request.user).first()
        if medico_propio:
            citas = citas.filter(medico=medico_propio)
        else:
            try:
                paciente_propio = Paciente.objects.get(usuario=request.user)
            except Paciente.DoesNotExist:
                return Response({'error': 'Usuario sin perfil de paciente o médico'}, status=status.HTTP_403_FORBIDDEN)
            citas = citas.filter(paciente=paciente_propio)

    medico_id = request.query_params.get('medico_id')
    if medico_id:
        citas = citas.filter(medico_id=medico_id)

    especialidad_id = request.query_params.get('especialidad_id')
    if especialidad_id:
        citas = citas.filter(especialidad_id=especialidad_id)

    estado_filter = request.query_params.get('estado')
    if estado_filter:
        citas = citas.filter(estado=estado_filter)

    citas = citas.order_by('fecha', 'hora_inicio')

    dias = {}
    for cita in citas:
        clave = cita.fecha.isoformat()
        dias.setdefault(clave, []).append({
            'id': cita.id,
            'hora_inicio': cita.hora_inicio.isoformat() if cita.hora_inicio else None,
            'hora_fin': cita.hora_fin.isoformat() if cita.hora_fin else None,
            'estado': cita.estado,
            'medico': str(cita.medico),
            'especialidad': cita.especialidad.nombre,
            'paciente': cita.paciente.usuario.get_full_name() or cita.paciente.usuario.email,
        })

    return Response({
        'vista': vista,
        'fecha_inicio': fecha_inicio_rango.isoformat(),
        'fecha_fin': fecha_fin_rango.isoformat(),
        'total_citas': citas.count(),
        'dias': dias,
    }, status=status.HTTP_200_OK)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mi_agenda_medico(request):
    """
    HU-024 - Agenda personal del médico.

    Devuelve únicamente las citas del médico autenticado.
    """

    medico = Medico.objects.filter(usuario=request.user).first()

    if not medico:
        return Response(
            {"error": "El usuario autenticado no tiene perfil de médico."},
            status=status.HTTP_403_FORBIDDEN,
        )

    citas = (
        Cita.objects.select_related(
            "paciente",
            "paciente__usuario",
            "especialidad",
            "eps",
        )
        .filter(medico=medico)
        .order_by("fecha", "hora_inicio")
    )

    serializer = AgendaMedicoSerializer(citas, many=True)

    return Response({
        "medico": {
            "id": medico.id,
            "nombre": str(medico),
        },
        "total_citas": citas.count(),
        "citas": serializer.data,
    })




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
    citas = Cita.objects.filter(paciente=paciente).select_related(
        'medico',
        'medico__usuario',
        'especialidad',
        'eps'
    ).order_by('-fecha_hora') # optimizado
    
    # Filtrar por estado si se proporciona
    estado_filter = request.query_params.get('estado')
    if estado_filter:
        citas = citas.filter(estado=estado_filter)
    
    # Paginar
    paginator = PageNumberPagination()
    paginator.page_size = 10
    paginated_citas = paginator.paginate_queryset(citas, request)
    
    serializer = CitaListSerializer(paginated_citas, many=True)
    
    return paginator.get_paginated_response({
        'paciente': {
            'id': paciente.id,
            'nombre': paciente.usuario.get_full_name() or paciente.usuario.email
        },
        'citas': serializer.data
    })
class EspecialidadViewSet(ModelViewSet):
    """
    API REST para gestión de especialidades médicas.

    - GET público: solo especialidades activas.
    - POST/PUT/DELETE: solo administrativo/superadministrador.
    - DELETE realiza desactivación lógica.
    """

    serializer_class = EspecialidadSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAdministrativeUser]
    http_method_names = ['get', 'post', 'put', 'delete', 'head', 'options']
    pagination_class = None

    def get_queryset(self):
        queryset = Especialidad.objects.prefetch_related('medicos__usuario').order_by('nombre')
        if IsAdministrativeUser.is_admin_user(self.request.user):
            return queryset
        return queryset.filter(activo=True)

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo', 'fecha_actualizacion'])


class HorarioMedicoViewSet(ModelViewSet):
    """
    CRUD de horarios médicos (HU-018).

    Permite:
    - Listar horarios
    - Crear horarios
    - Editar horarios
    - Eliminar horarios
    """

    serializer_class = HorarioMedicoSerializer
    queryset = HorarioMedico.objects.select_related("medico", "medico__usuario").order_by(
        "medico", "dia_semana", "hora_inicio"
    )

    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAdministrativeUser]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]


class CitaPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class CitaViewSet(ModelViewSet):
    """
    POST /api/citas/

    Request:
    {
      "paciente": 1,
      "medico": 1,
      "especialidad": 1,
      "fecha": "2026-07-20",
      "hora_inicio": "09:00:00",
      "hora_fin": "09:30:00",
      "eps": 1,
      "motivo_consulta": "Dolor de cabeza",
      "tipo_cita": "consulta_general"
    }
    """

    serializer_class = CitaSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAdministrativeOrAuthenticatedPatient]
    pagination_class = CitaPagination
    pagination_class = CitaPagination
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = Cita.objects.select_related(
            'paciente',
            'paciente__usuario',
            'medico',
            'medico__usuario',
            'especialidad',
            'eps',
        ).order_by('-fecha', '-hora_inicio')
        if not IsAdministrativeUser.is_admin_user(self.request.user):
            queryset = queryset.filter(paciente__usuario=self.request.user)

        queryset = CitaService.buscar_citas(
            queryset,
            self.request.query_params
        )
        return queryset
    
    
        if not IsAdministrativeUser.is_admin_user(self.request.user):
            queryset = queryset.filter(paciente__usuario=self.request.user)

        queryset = CitaService.buscar_citas(
            queryset,
            self.request.query_params
        )
        return queryset
    
    
    def _error_response(self, errors, message='No es posible agendar la cita'):
        return Response(
            {
                'status': 'error',
                'code': 400,
                'message': message,
                'errors': errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def create(self, request, *args, **kwargs):
        """
        Creación de citas (HU-007 paciente / HU-009 administrativo).

        - Un paciente autenticado solo puede agendar citas para sí mismo: el
          campo 'paciente' del payload se ignora y se reemplaza por su propio
          registro, sin excepción a ninguna regla de negocio.
        - Un administrativo/superadministrador puede elegir el paciente en
          nombre de quien agenda, pero la cita pasa por exactamente las mismas
          validaciones (disponibilidad del médico, topes EPS, frecuencia,
          capacidad diaria, etc.) que aplicarían a ese paciente. No hay bypass
          de reglas de negocio para el rol administrativo.

        Toda la validación de disponibilidad/negocio vive en CitaService
        (con locking vía select_for_update), invocada desde CitaSerializer.
        """
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        if not IsAdministrativeUser.is_admin_user(request.user):
            try:
                paciente_propio = Paciente.objects.get(usuario=request.user)
            except Paciente.DoesNotExist:
                return self._error_response(
                    {'paciente': ['El usuario autenticado no tiene un perfil de paciente.']},
                    message='No autorizado',
                )
            data['paciente'] = paciente_propio.id

        serializer = self.get_serializer(data=data)
        """
        Creación de citas (HU-007 paciente / HU-009 administrativo).

        - Un paciente autenticado solo puede agendar citas para sí mismo: el
          campo 'paciente' del payload se ignora y se reemplaza por su propio
          registro, sin excepción a ninguna regla de negocio.
        - Un administrativo/superadministrador puede elegir el paciente en
          nombre de quien agenda, pero la cita pasa por exactamente las mismas
          validaciones (disponibilidad del médico, topes EPS, frecuencia,
          capacidad diaria, etc.) que aplicarían a ese paciente. No hay bypass
          de reglas de negocio para el rol administrativo.

        Toda la validación de disponibilidad/negocio vive en CitaService
        (con locking vía select_for_update), invocada desde CitaSerializer.
        """
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        if not IsAdministrativeUser.is_admin_user(request.user):
            try:
                paciente_propio = Paciente.objects.get(usuario=request.user)
            except Paciente.DoesNotExist:
                return self._error_response(
                    {'paciente': ['El usuario autenticado no tiene un perfil de paciente.']},
                    message='No autorizado',
                )
            data['paciente'] = paciente_propio.id

        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            return self._error_response(serializer.errors)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                'status': 'success',
                'code': 201,
                'data': serializer.data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

class DashboardMetricsView(APIView):
    # Solo administrativos/superadmin accede
    permission_classes = [IsAdminUser]

    def get(self, request):
        hoy = timezone.now().date()
        
        # Consultas de métricas
        stats = Cita.objects.aggregate(
            total=Count('id'),
            citas_hoy=Count('id', filter=Q(fecha=hoy)),
            canceladas=Count('id', filter=Q(estado='CANCELADA')),
            pendientes=Count('id', filter=Q(estado='PENDIENTE'))
        )
        
        return Response({
            "fecha_corte": hoy,
            "metricas": stats
        })
    

class DashboardOcupacionView(APIView):
    """
    HU-021 - Reporte de ocupación por médico y especialidad.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):

        queryset = Cita.objects.exclude(estado="CANCELADA")

        fecha_inicio = request.query_params.get("fecha_inicio")
        fecha_fin = request.query_params.get("fecha_fin")

        if fecha_inicio:
            queryset = queryset.filter(fecha__gte=fecha_inicio)

        if fecha_fin:
            queryset = queryset.filter(fecha__lte=fecha_fin)

        total_citas = queryset.count()

        ocupacion_medicos = (
            queryset.values(
                "medico__usuario__first_name",
                "medico__usuario__last_name",
            )
            .annotate(
                total=Count("id")
            )
            .order_by("-total")
        )

        ocupacion_especialidades = (
            queryset.values(
                "especialidad__nombre",
            )
            .annotate(
                total=Count("id")
            )
            .order_by("-total")
        )

        ocupacion_eps = (
            queryset.values(
                "eps__nombre",
            )
            .annotate(
                total=Count("id")
            )
            .order_by("-total")
        )

        return Response({

            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,

            "total_citas": total_citas,

            "por_medico": [
                {
                    "medico": (
                        f"{item['medico__usuario__first_name']} "
                        f"{item['medico__usuario__last_name']}"
                    ).strip(),
                    "total": item["total"],
                }
                for item in ocupacion_medicos
            ],

            "por_especialidad": [
                {
                    "especialidad": item["especialidad__nombre"],
                    "total": item["total"],
                }
                for item in ocupacion_especialidades
            ],

            "por_eps": [
                {
                    "eps": item["eps__nombre"],
                    "total": item["total"],
                }
                for item in ocupacion_eps
            ],
        })

class AlertaTopeEnviadaListView(APIView):
    """
    GET /api/alertas-topes/ (HU-022)

    Lista las alertas de tope EPS ya enviadas a superadministrador
    (para el panel de alertas del dashboard). Soporta ?eps_id= como filtro
    opcional.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsSuperAdministrativeUser]

    def get(self, request):
        alertas = AlertaTopeEnviada.objects.select_related('eps').all()
        eps_id = request.query_params.get('eps_id')
        if eps_id:
            alertas = alertas.filter(eps_id=eps_id)
        serializer = AlertaTopeEnviadaSerializer(alertas, many=True)
        return Response({'total': alertas.count(), 'alertas': serializer.data})


class SedeViewSet(ModelViewSet):
    """
    CRUD de sedes de la institución (HU-023).

    Lectura pública/autenticada; escritura solo administrativos.
    """
    serializer_class = SedeSerializer
    queryset = Sede.objects.all().order_by('nombre')
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAdministrativeUser]
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']


class FeriadoViewSet(ModelViewSet):
    """
    CRUD de feriados institucionales (HU-023).

    Un feriado registrado aquí bloquea automáticamente el agendamiento de
    citas en esa fecha (ver CitaService.validate_payload).
    """
    serializer_class = FeriadoSerializer
    queryset = Feriado.objects.all().order_by('fecha')
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAdministrativeUser]
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    pagination_class = None


class ConfiguracionGlobalView(APIView):
    """
    GET/PUT de la configuración global del sistema (HU-023).

    Tabla singleton: siempre lee/escribe la única fila de ConfiguracionGlobal.
    Lectura: cualquier usuario autenticado. Escritura: solo superadministrador.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsSuperAdministrativeUser]

    def get(self, request):
        config = ConfiguracionGlobal.get_solo()
        serializer = ConfiguracionGlobalSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        config = ConfiguracionGlobal.get_solo()
        serializer = ConfiguracionGlobalSerializer(config, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {'status': 'error', 'code': 400, 'message': 'Configuración inválida', 'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response({'status': 'success', 'code': 200, 'data': serializer.data})
