from django.urls import path
from . import views
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'especialidades', views.EspecialidadViewSet, basename='especialidad')
router.register(r'citas', views.CitaViewSet, basename='cita')

urlpatterns = [
    path('pacientes/registro/', views.registro_paciente, name='registro_paciente'),
    path('pacientes/login/', views.PacienteLoginView.as_view(), name='login'),
]

urlpatterns += router.urls