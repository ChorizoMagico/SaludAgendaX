// Fuente única de verdad para los 4 roles del sistema.
// La usan Login.jsx, Register.jsx y AppRouter.jsx para no repetir esta info.

export const ROLES = [
  {
    key: "paciente",
    icon: "person",
    label: "Paciente",
    desc: "Agenda y gestiona tus citas médicas.",
  },
  {
    key: "medico",
    icon: "stethoscope",
    label: "Médico",
    desc: "Consulta tu agenda y disponibilidad.",
  },
  {
    key: "administrativo",
    icon: "admin_panel_settings",
    label: "Administrativo",
    desc: "Gestiona médicos, pacientes y citas.",
  },
  {
    key: "superadministrador",
    icon: "shield_person",
    label: "Superadmin",
    desc: "Configura reglas de negocio y topes por EPS.",
  },
];

// A dónde va cada rol después de autenticarse (login o registro).
// Ajusta las rutas si tus paths en AppRouter.jsx son distintos.
export const REDIRECT_BY_ROLE = {
  paciente: "/paciente/dashboard",
  medico: "/medico/mi-agenda",
  administrativo: "/admin/dashboard",
  superadministrador: "/superadmin/dashboard",
};