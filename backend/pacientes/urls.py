from django.urls import path
from . import views
from rest_framework.routers import DefaultRouter
from .views import DashboardMetricsView

router = DefaultRouter()
router.register(r'especialidades', views.EspecialidadViewSet, basename='especialidad')
router.register(r'citas', views.CitaViewSet, basename='cita')

urlpatterns = [
    path('registro/', views.registro_paciente, name='registro_paciente'),
    path('login/', views.PacienteLoginView.as_view(), name='login'),
    path('recuperar-contrasena/', views.recuperar_contrasena, name='recuperar_contrasena'),
    path('reset-contrasena/', views.reset_contrasena, name='reset_contrasena'),
    path('perfil/', views.perfil_paciente, name='perfil_paciente'),
    path('disponibilidad/', views.disponibilidad_medica, name='disponibilidad_medica'),
    path('citas/<int:cita_id>/cancelar/', views.cancelar_cita, name='cancelar_cita'),
    path('citas/historial/', views.historial_citas_paciente, name='historial_citas'),
    path('pacientes/registro/', views.registro_paciente, name='registro_paciente'),
    path('pacientes/login/', views.PacienteLoginView.as_view(), name='login'),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
]

urlpatterns += router.urls
