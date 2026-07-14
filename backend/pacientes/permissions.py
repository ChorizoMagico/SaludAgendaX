from rest_framework.permissions import SAFE_METHODS, BasePermission
from .models import Paciente


class IsAdministrativeUser(BasePermission):
    """
    Permite lectura pública y restringe escrituras a administrativos/superadmins.
    """

    admin_group_names = {'administrativo', 'superadministrador'}

    @classmethod
    def is_admin_user(cls, user):
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        return user.groups.filter(name__in=cls.admin_group_names).exists()

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return self.is_admin_user(request.user)


class IsAdministrativeOrAuthenticatedPatient(BasePermission):
    """
    Permite acceso a administrativos y pacientes autenticados.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if IsAdministrativeUser.is_admin_user(user):
            return True
        return Paciente.objects.filter(usuario=user).exists()
