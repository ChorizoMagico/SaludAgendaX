from django.urls import path
from . import views
from rest_framework.routers import DefaultRouter
from .views import DashboardMetricsView

router = DefaultRouter()
router.register(r'especialidades', views.EspecialidadViewSet, basename='especialidad')
router.register(r'horarios', views.HorarioMedicoViewSet, basename='horario')
router.register(r'citas', views.CitaViewSet, basename='cita')
router.register(r'sedes', views.SedeViewSet, basename='sede')
router.register(r'feriados', views.FeriadoViewSet, basename='feriado')

urlpatterns = [
    path('registro/', views.registro_paciente, name='registro_paciente'),
    path('login/', views.PacienteLoginView.as_view(), name='login'),
    path('recuperar-contrasena/', views.recuperar_contrasena, name='recuperar_contrasena'),
    path('reset-contrasena/', views.reset_contrasena, name='reset_contrasena'),
    path('perfil/', views.perfil_paciente, name='perfil_paciente'),
    path('disponibilidad/', views.disponibilidad_medica, name='disponibilidad_medica'),
    path('citas/<int:cita_id>/cancelar/', views.cancelar_cita, name='cancelar_cita'),
    path('citas/<int:cita_id>/reprogramar/', views.reprogramar_cita, name='reprogramar_cita'),
    path('citas/historial/', views.historial_citas_paciente, name='historial_citas'),
    path('calendario/', views.calendario_citas, name='calendario_citas'),
    path('pacientes/registro/', views.registro_paciente, name='registro_paciente'),
    path('pacientes/login/', views.PacienteLoginView.as_view(), name='login'),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path("dashboard/ocupacion/",views.DashboardOcupacionView.as_view(),name="dashboard-ocupacion",),
    path('medicos/mi-agenda/', views.mi_agenda_medico, name='mi-agenda-medico'),
    path('alertas-topes/', views.AlertaTopeEnviadaListView.as_view(), name='alertas-topes'),
    path('configuracion/', views.ConfiguracionGlobalView.as_view(), name='configuracion-global'),
]

urlpatterns += router.urls
