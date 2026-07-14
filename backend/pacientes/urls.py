from django.urls import path
from . import views

urlpatterns = [
    path('registro/', views.registro_paciente, name='registro_paciente'),
    path('login/', views.PacienteLoginView.as_view(), name='login'),
]