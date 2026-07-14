from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import PacienteRegistroSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import PacienteTokenSerializer, EspecialidadSerializer, CitaSerializer
from .models import Cita, Especialidad
from .permissions import IsAdministrativeOrAuthenticatedPatient, IsAdministrativeUser
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.viewsets import ModelViewSet

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

    def get_queryset(self):
        queryset = Especialidad.objects.prefetch_related('medicos__usuario').order_by('nombre')
        if IsAdministrativeUser.is_admin_user(self.request.user):
            return queryset
        return queryset.filter(activo=True)

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo', 'fecha_actualizacion'])


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
        if IsAdministrativeUser.is_admin_user(self.request.user):
            return queryset
        return queryset.filter(paciente__usuario=self.request.user)

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
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._error_response(serializer.errors)

        try:
            self.perform_create(serializer)
        except serializers.ValidationError as exc:
            return self._error_response(exc.detail)

        cita = serializer.instance
        response_serializer = self.get_serializer(cita)
        agenda_ocupada = Cita.objects.filter(
            medico=cita.medico,
            fecha=cita.fecha,
        ).exclude(estado='CANCELADA').count()

        return Response(
            {
                'status': 'success',
                'code': 201,
                'message': 'Cita creada exitosamente',
                'data': response_serializer.data,
                'agenda': {
                    'medico': cita.medico_id,
                    'fecha': cita.fecha,
                    'citas_ocupadas': agenda_ocupada,
                },
                'alerts': serializer.context.get('alerts', []),
            },
            status=status.HTTP_201_CREATED,
        )