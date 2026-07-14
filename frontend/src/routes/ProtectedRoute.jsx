import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Envuelve una página que requiere sesión iniciada.
 * Uso:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/paciente/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 * Si además quieres restringir por rol:
 *   <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
 */
import { Outlet } from "react-router-dom";

export default function ProtectedRoute({ rolesPermitidos }) {
  const { isAuthenticated, rol, loading } = useAuth();

  if (loading) return null; // o un spinner de carga de sesión

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
