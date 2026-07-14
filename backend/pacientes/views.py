from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import PacienteRegistroSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import PacienteTokenSerializer

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