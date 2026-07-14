import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "../routes/ProtectedRoute";

/**
 * HU-002: Security Testing - Protected Route Authorization Tests
 * 
 * Pruebas para validar que ProtectedRoute:
 * 1. Permite acceso a usuarios autenticados con rol permitido
 * 2. Deniega acceso a usuarios con rol no permitido
 * 3. Redirige a login si no está autenticado
 */

// Componentes simulados para las rutas protegidas
function PacienteDashboard() {
  return <div>Paciente Dashboard Content</div>;
}

function MedicoAgenda() {
  return <div>Medico Agenda Content</div>;
}

function AdminDashboard() {
  return <div>Admin Dashboard Content</div>;
}

function LoginPage() {
  return <div>Login Page</div>;
}

function HomePage() {
  return <div>Home Page</div>;
}

describe("HU-002: ProtectedRoute Authorization", () => {
  describe("CA-3: Access to protected routes", () => {
    it("should allow authenticated paciente to access paciente route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
                <Route path="/paciente/dashboard" element={<PacienteDashboard />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000001" password="paciente123" />
          </AuthProvider>
        </BrowserRouter>
      );

      // Trigger login
      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/paciente dashboard content/i)).toBeInTheDocument();
      });
    });

    it("should allow authenticated medico to access medico route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["medico"]} />}>
                <Route path="/medico/mi-agenda" element={<MedicoAgenda />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000002" password="medico123" />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/medico agenda content/i)).toBeInTheDocument();
      });
    });

    it("should allow authenticated admin to access admin route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["administrativo", "superadministrador"]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000003" password="admin123" />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/admin dashboard content/i)).toBeInTheDocument();
      });
    });

    it("should redirect unauthenticated user to login", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
                <Route path="/paciente/dashboard" element={<PacienteDashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Sin hacer login, intentar acceder a ruta protegida
      window.history.pushState({}, "Test", "/paciente/dashboard");

      await waitFor(() => {
        expect(screen.getByText(/login page/i)).toBeInTheDocument();
      });
    });
  });

  describe("CA-4: Role-based access restriction", () => {
    it("should deny paciente access to medico route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["medico"]} />}>
                <Route path="/medico/mi-agenda" element={<MedicoAgenda />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000001" password="paciente123" deniedPath="/medico/mi-agenda" />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/home page/i)).toBeInTheDocument();
        expect(screen.queryByText(/medico agenda content/i)).not.toBeInTheDocument();
      });
    });

    it("should deny paciente access to admin route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["administrativo"]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000001" password="paciente123" deniedPath="/admin/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/home page/i)).toBeInTheDocument();
        expect(screen.queryByText(/admin dashboard content/i)).not.toBeInTheDocument();
      });
    });

    it("should deny medico access to paciente route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["paciente"]} />}>
                <Route path="/paciente/dashboard" element={<PacienteDashboard />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000002" password="medico123" deniedPath="/paciente/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/home page/i)).toBeInTheDocument();
        expect(screen.queryByText(/paciente dashboard content/i)).not.toBeInTheDocument();
      });
    });

    it("should deny medico access to admin route", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute rolesPermitidos={["administrativo"]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Route>
            </Routes>
            <TestLoginComponent cedula="1000000002" password="medico123" deniedPath="/admin/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(screen.getByText(/home page/i)).toBeInTheDocument();
        expect(screen.queryByText(/admin dashboard content/i)).not.toBeInTheDocument();
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test Helper Component
// ─────────────────────────────────────────────────────────────────────────

function TestLoginComponent({ cedula, password, deniedPath }) {
  const { login } = require("../context/AuthContext").useAuth();

  return (
    <button
      data-testid="test-login"
      onClick={async () => {
        try {
          await login(cedula, password);
          if (deniedPath) {
            window.history.pushState({}, "Test", deniedPath);
          }
        } catch (e) {
          console.error("Test login error:", e);
        }
      }}
    >
      Test Login
    </button>
  );
}
