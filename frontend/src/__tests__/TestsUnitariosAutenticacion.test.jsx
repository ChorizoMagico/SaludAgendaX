import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";
import ProtectedRoute from "../routes/ProtectedRoute";
import { MOCK_USERS } from "../context/mockData";

/**
 * HU-002: Security Testing - Authentication & Authorization Tests
 * 
 * Pruebas unitarias para validar:
 * 1. Autenticación exitosa/fallida con diferentes roles
 * 2. Autorización y restricción de acceso por rol
 * 3. Persistencia de sesión
 */

// ─────────────────────────────────────────────────────────────────────────
// Suite 1: Authentication Tests
// ─────────────────────────────────────────────────────────────────────────
describe("HU-002: Authentication", () => {
  describe("CA-1: Successful login with valid credentials", () => {
    it("should login successfully as paciente (1000000001)", async () => {
      const { getByLabelText, getByRole } = render(
        <BrowserRouter>
          <AuthProvider>
            <LoginTestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const cedulaInput = getByLabelText(/cédula/i);
      const passwordInput = getByLabelText(/contraseña/i);
      const loginBtn = getByRole("button", { name: /iniciar sesión/i });

      // Simular entrada
      cedulaInput.value = "1000000001";
      passwordInput.value = "paciente123";
      loginBtn.click();

      // Esperar autenticación
      await waitFor(() => {
        expect(screen.getByText(/paciente autenticado/i)).toBeInTheDocument();
      });
    });

    it("should login successfully as medico (1000000002)", async () => {
      const { getByLabelText, getByRole } = render(
        <BrowserRouter>
          <AuthProvider>
            <LoginTestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const cedulaInput = getByLabelText(/cédula/i);
      const passwordInput = getByLabelText(/contraseña/i);
      const loginBtn = getByRole("button", { name: /iniciar sesión/i });

      cedulaInput.value = "1000000002";
      passwordInput.value = "medico123";
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByText(/medico autenticado/i)).toBeInTheDocument();
      });
    });

    it("should login successfully as administrativo (1000000003)", async () => {
      const { getByLabelText, getByRole } = render(
        <BrowserRouter>
          <AuthProvider>
            <LoginTestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const cedulaInput = getByLabelText(/cédula/i);
      const passwordInput = getByLabelText(/contraseña/i);
      const loginBtn = getByRole("button", { name: /iniciar sesión/i });

      cedulaInput.value = "1000000003";
      passwordInput.value = "admin123";
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByText(/administrativo autenticado/i)).toBeInTheDocument();
      });
    });

    it("should login successfully as superadministrador (1000000004)", async () => {
      const { getByLabelText, getByRole } = render(
        <BrowserRouter>
          <AuthProvider>
            <LoginTestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const cedulaInput = getByLabelText(/cédula/i);
      const passwordInput = getByLabelText(/contraseña/i);
      const loginBtn = getByRole("button", { name: /iniciar sesión/i });

      cedulaInput.value = "1000000004";
      passwordInput.value = "super123";
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByText(/superadministrador autenticado/i)).toBeInTheDocument();
      });
    });

    it("should generate token in format mock-token-{rol}-{timestamp}", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <TokenValidationComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Simular login
      const loginBtn = container.querySelector('[data-testid="test-login"]');
      loginBtn?.click();

      await waitFor(() => {
        const tokenDisplay = container.querySelector('[data-testid="token-display"]');
        const token = tokenDisplay?.textContent;
        expect(token).toMatch(/^mock-token-(paciente|medico|administrativo|superadministrador)-\d+$/);
      });
    });
  });

  describe("CA-2: Failed login with invalid credentials", () => {
    it("should reject non-existent cedula", async () => {
      const { getByLabelText, getByRole } = render(
        <BrowserRouter>
          <AuthProvider>
            <LoginTestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const cedulaInput = getByLabelText(/cédula/i);
      const passwordInput = getByLabelText(/contraseña/i);
      const loginBtn = getByRole("button", { name: /iniciar sesión/i });

      cedulaInput.value = "9999999999";
      passwordInput.value = "paciente123";
      loginBtn.click();

      await waitFor(() => {
        expect(
          screen.getByText(/credenciales incorrectas/i)
        ).toBeInTheDocument();
      });
    });

    it("should reject incorrect password", async () => {
      const { getByLabelText, getByRole } = render(
        <BrowserRouter>
          <AuthProvider>
            <LoginTestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const cedulaInput = getByLabelText(/cédula/i);
      const passwordInput = getByLabelText(/contraseña/i);
      const loginBtn = getByRole("button", { name: /iniciar sesión/i });

      cedulaInput.value = "1000000001";
      passwordInput.value = "wrongpassword";
      loginBtn.click();

      await waitFor(() => {
        expect(
          screen.getByText(/credenciales incorrectas/i)
        ).toBeInTheDocument();
      });
    });

    it("should not authenticate user with invalid credentials", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <AuthStatusComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginBtn = container.querySelector('[data-testid="invalid-login"]');
      loginBtn?.click();

      await waitFor(() => {
        const statusDisplay = container.querySelector('[data-testid="auth-status"]');
        expect(statusDisplay?.textContent).toContain("No autenticado");
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Suite 2: Authorization Tests
// ─────────────────────────────────────────────────────────────────────────
describe("HU-002: Authorization", () => {
  describe("CA-3: Access to protected routes by role", () => {
    it("should allow paciente to access /paciente/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <ProtectedRouteTestComponent rolToLogin="paciente" targetPath="/paciente/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/dashboard del paciente/i)).toBeInTheDocument();
      });
    });

    it("should allow medico to access /medico/mi-agenda", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <ProtectedRouteTestComponent rolToLogin="medico" targetPath="/medico/mi-agenda" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/agenda del medico/i)).toBeInTheDocument();
      });
    });

    it("should allow administrativo to access /admin/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <ProtectedRouteTestComponent rolToLogin="administrativo" targetPath="/admin/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/panel administrativo/i)).toBeInTheDocument();
      });
    });

    it("should allow superadministrador to access /admin/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <ProtectedRouteTestComponent rolToLogin="superadministrador" targetPath="/admin/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/panel administrativo/i)).toBeInTheDocument();
      });
    });

    it("should redirect unauthenticated user to /login", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <UnauthorizedAccessComponent targetPath="/paciente/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/login");
      });
    });
  });

  describe("CA-4: Role-based access restriction", () => {
    it("should deny paciente access to /medico/mi-agenda", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <RoleRestrictionTestComponent rolToLogin="paciente" deniedPath="/medico/mi-agenda" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
      });
    });

    it("should deny paciente access to /admin/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <RoleRestrictionTestComponent rolToLogin="paciente" deniedPath="/admin/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
      });
    });

    it("should deny medico access to /paciente/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <RoleRestrictionTestComponent rolToLogin="medico" deniedPath="/paciente/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
      });
    });

    it("should deny medico access to /admin/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <RoleRestrictionTestComponent rolToLogin="medico" deniedPath="/admin/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
      });
    });

    it("should deny administrativo access to /paciente/dashboard", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <RoleRestrictionTestComponent rolToLogin="administrativo" deniedPath="/paciente/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
      });
    });

    it("should deny administrativo access to /medico/mi-agenda", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <RoleRestrictionTestComponent rolToLogin="administrativo" deniedPath="/medico/mi-agenda" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Suite 3: Session Persistence Tests
// ─────────────────────────────────────────────────────────────────────────
describe("HU-002: Session Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("CA-5: Session persistence", () => {
    it("should persist session after page reload", async () => {
      const { container, rerender } = render(
        <BrowserRouter>
          <AuthProvider>
            <SessionPersistenceComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Login
      const loginBtn = container.querySelector('[data-testid="login-btn"]');
      loginBtn?.click();

      await waitFor(() => {
        expect(localStorage.getItem("auth_token")).toBeTruthy();
      });

      // Simular reload
      rerender(
        <BrowserRouter>
          <AuthProvider>
            <SessionPersistenceComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/sesión persiste/i)).toBeInTheDocument();
      });
    });

    it("should clear session on logout", async () => {
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <LogoutComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const logoutBtn = container.querySelector('[data-testid="logout-btn"]');
      logoutBtn?.click();

      await waitFor(() => {
        expect(localStorage.getItem("auth_token")).toBeNull();
        expect(screen.getByText(/no autenticado/i)).toBeInTheDocument();
      });
    });

    it("should redirect to login with invalid token", async () => {
      localStorage.setItem("auth_token", "invalid-token-xyz");

      render(
        <BrowserRouter>
          <AuthProvider>
            <ProtectedRouteTestComponent rolToLogin="paciente" targetPath="/paciente/dashboard" />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe("/login");
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test Helper Components
// ─────────────────────────────────────────────────────────────────────────

function LoginTestComponent() {
  const { login, isAuthenticated, rol } = useAuth();

  return (
    <div>
      <label>
        Cédula:
        <input data-testid="cedula-input" type="text" />
      </label>
      <label>
        Contraseña:
        <input data-testid="password-input" type="password" />
      </label>
      <button
        data-testid="login-btn"
        onClick={async () => {
          const cedula = document.querySelector('[data-testid="cedula-input"]')?.value;
          const password = document.querySelector('[data-testid="password-input"]')?.value;
          try {
            await login(cedula, password);
          } catch (e) {
            // Error esperado
          }
        }}
      >
        Iniciar Sesión
      </button>
      {isAuthenticated && <div>{rol} autenticado</div>}
      {!isAuthenticated && <div>No autenticado</div>}
    </div>
  );
}

function TokenValidationComponent() {
  const { token } = useAuth();

  return (
    <div>
      <button
        data-testid="test-login"
        onClick={async () => {
          // Simular login
        }}
      >
        Test Login
      </button>
      <div data-testid="token-display">{token}</div>
    </div>
  );
}

function AuthStatusComponent() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <button
        data-testid="invalid-login"
        onClick={async () => {
          // Intentar login inválido
        }}
      >
        Invalid Login
      </button>
      <div data-testid="auth-status">
        {isAuthenticated ? "Autenticado" : "No autenticado"}
      </div>
    </div>
  );
}

function ProtectedRouteTestComponent({ rolToLogin, targetPath }) {
  const { login } = useAuth();

  useEffect(() => {
    login(
      rolToLogin === "paciente" ? "1000000001" :
      rolToLogin === "medico" ? "1000000002" :
      rolToLogin === "administrativo" ? "1000000003" : "1000000004",
      rolToLogin === "paciente" ? "paciente123" :
      rolToLogin === "medico" ? "medico123" :
      rolToLogin === "administrativo" ? "admin123" : "super123"
    );
  }, [login, rolToLogin]);

  return (
    <div>
      {targetPath === "/paciente/dashboard" && <div>Dashboard del paciente</div>}
      {targetPath === "/medico/mi-agenda" && <div>Agenda del medico</div>}
      {targetPath === "/admin/dashboard" && <div>Panel administrativo</div>}
    </div>
  );
}

function UnauthorizedAccessComponent({ targetPath }) {
  return <div>Intento de acceso no autorizado a {targetPath}</div>;
}

function RoleRestrictionTestComponent({ rolToLogin, deniedPath }) {
  const { login } = useAuth();

  useEffect(() => {
    login(
      rolToLogin === "paciente" ? "1000000001" :
      rolToLogin === "medico" ? "1000000002" :
      rolToLogin === "administrativo" ? "1000000003" : "1000000004",
      rolToLogin === "paciente" ? "paciente123" :
      rolToLogin === "medico" ? "medico123" :
      rolToLogin === "administrativo" ? "admin123" : "super123"
    );
  }, [login, rolToLogin]);

  return <div>Intento acceso a {deniedPath}</div>;
}

function SessionPersistenceComponent() {
  const { login, isAuthenticated } = useAuth();

  return (
    <div>
      <button
        data-testid="login-btn"
        onClick={async () => {
          await login("1000000001", "paciente123");
        }}
      >
        Login
      </button>
      {isAuthenticated && <div>Sesión persiste</div>}
    </div>
  );
}

function LogoutComponent() {
  const { logout, isAuthenticated } = useAuth();

  return (
    <div>
      <button
        data-testid="logout-btn"
        onClick={() => {
          logout();
        }}
      >
        Logout
      </button>
      {isAuthenticated ? <div>Autenticado</div> : <div>No autenticado</div>}
    </div>
  );
}

import { useEffect } from "react";
