import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Envuelve páginas que requieren sesión iniciada.
 *
 * Uso:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/paciente/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 * Con restricción por rol:
 *   <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
 */
export default function ProtectedRoute({ rolesPermitidos }) {
  const { isAuthenticated, rol, loading } = useAuth();
  const location = useLocation();

  // Mientras se resuelve si hay una sesión guardada en sessionStorage,
  // no renderizamos nada (evita un parpadeo hacia /login antes de tiempo).
  if (loading) return null;

  if (!isAuthenticated) {
    // Guardamos la ruta a la que intentaba entrar en location.state.from,
    // así Login.jsx puede (opcionalmente) redirigirlo de vuelta ahí
    // después de autenticarse en vez de mandarlo siempre al dashboard.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}