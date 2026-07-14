from django.urls import path
from . import views

urlpatterns = [
    path('registro/', views.registro_paciente, name='registro_paciente'),
    path('login/', views.PacienteLoginView.as_view(), name='login'),
    path('recuperar-contrasena/', views.recuperar_contrasena, name='recuperar_contrasena'),
    path('reset-contrasena/', views.reset_contrasena, name='reset_contrasena'),
    path('perfil/', views.perfil_paciente, name='perfil_paciente'),
    path('disponibilidad/', views.disponibilidad_medica, name='disponibilidad_medica'),
]