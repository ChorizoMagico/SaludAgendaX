import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import Principal from "./pages/public/Principal";
import Login from "./pages/auth/Login";

// Se carga bajo demanda: React.lazy + import() dinámico.
// Vite detecta el import() y automáticamente genera un chunk .js aparte
// para cada uno de estos archivos.
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const PacienteDashboard = lazy(() => import("./pages/paciente/PacienteDashboard"));
const MiAgenda = lazy(() => import("./pages/medico/MedicoAgenda"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard"));

// Se muestra brevemente mientras el navegador descarga el chunk del
// componente pedido (usualmente milisegundos, con buena conexión).
function CargandoPagina() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFDFC]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#0E9668] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#48605C]">Cargando...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Suspense envuelve TODAS las rutas: cualquier componente lazy
            que aún no terminó de descargarse muestra este fallback. */}
        <Suspense fallback={<CargandoPagina />}>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<Principal />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Paciente */}
            <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
              <Route path="/paciente/dashboard" element={<PacienteDashboard />} />
            </Route>

            {/* Médico */}
            <Route element={<ProtectedRoute rolesPermitidos={["medico"]} />}>
              <Route path="/medico/mi-agenda" element={<MiAgenda />} />
            </Route>

            {/* Administrativo */}
            <Route element={<ProtectedRoute rolesPermitidos={["administrativo"]} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>

            {/* Superadministrador */}
            <Route element={<ProtectedRoute rolesPermitidos={["superadministrador"]} />}>
              <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;