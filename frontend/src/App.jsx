import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Principal from "./pages/public/Principal";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ProtectedRoute from "./routes/ProtectedRoute";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import PacienteDashboard from "./pages/paciente/PacienteDashboard";
import MiAgenda from "./pages/medico/MedicoAgenda";
// import AdminDashboard from "./pages/admin/AdminDashboard";

// Descomentar a medida que se vayan creando las páginas restantes

// import GestionMedicos from "./pages/admin/GestionMedicos";
// import CalendarioGeneral from "./pages/admin/CalendarioGeneral";
// import Reportes from "./pages/admin/Reportes";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Principal />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Paciente: agendar, mis citas y perfil viven como pestañas dentro de Dashboard.jsx */}
          <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
            <Route path="/paciente/dashboard" element={<PacienteDashboard />} />
          </Route>

          {/* Médico */}
          <Route element={<ProtectedRoute rolesPermitidos={["medico"]} />}>
            <Route path="/medico/mi-agenda" element={<MiAgenda />} />
          </Route>

          {/* Administrativo + Superadministrador */}
          {/* <Route element={<ProtectedRoute rolesPermitidos={["administrativo", "superadministrador"]} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/medicos" element={<GestionMedicos />} />
            <Route path="/admin/calendario" element={<CalendarioGeneral />} />
            <Route path="/admin/reportes" element={<Reportes />} />
          </Route> */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;