/**
 * HU-002: 
 * 
 * Ejecutar pruebas manuales de autenticación y autorización desde la consola del navegador.
 * 
 * Uso:
 * 1. Abrir herramientas de desarrollo con (F12)
 * 2. Ir a "Console"
 * 3. Copiar y pegar el código de las funciones de TestsUnitariosAutorizacionRestriccion.test
 * 4. Ejecutar: 
 *    - securityTests.testAuthenticationPaciente()
 *    - securityTests.testAuthorizationDenial()
 *    - etc.
 */

const securityTests = {
  // Usuarios de prueba
  testUsers: {
    paciente: { cedula: "1000000001", password: "paciente123", rol: "paciente", nombre: "Valeria Restrepo" },
    medico: { cedula: "1000000002", password: "medico123", rol: "medico", nombre: "Andrés Mejía" },
    administrativo: { cedula: "1000000003", password: "admin123", rol: "administrativo", nombre: "Laura Gómez" },
    superadministrador: { cedula: "1000000004", password: "super123", rol: "superadministrador", nombre: "Carlos Ríos" },
  },

  protectedRoutes: {
    paciente: "/paciente/dashboard",
    medico: "/medico/mi-agenda",
    administrativo: "/admin/dashboard",
    superadministrador: "/admin/dashboard",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-001: Login Paciente Exitoso
  // ─────────────────────────────────────────────────────────────────────────
  async testAuthenticationPaciente() {
    console.log("🧪 TC-001: Login Paciente Exitoso");
    console.log("─".repeat(60));
    const user = this.testUsers.paciente;
    console.log(`Intentando login con:`);
    console.log(`  Cédula: ${user.cedula}`);
    console.log(`  Contraseña: ${user.password}`);
    console.log(`  Esperado: Redirige a /paciente/dashboard`);
    console.log(`\n⏳ Navega a: http://localhost:5173/login`);
    console.log(`Completa el login manualmente y verifica redirección.`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Usuario autenticado: ${user.nombre}`);
    console.log(`  - Rol: ${user.rol}`);
    console.log(`  - URL actual: /paciente/dashboard`);
    console.log(`  - Token en localStorage: mock-token-paciente-xxxxx`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-002: Login Médico Exitoso
  // ─────────────────────────────────────────────────────────────────────────
  async testAuthenticationMedico() {
    console.log("🧪 TC-002: Login Médico Exitoso");
    console.log("─".repeat(60));
    const user = this.testUsers.medico;
    console.log(`Intentando login con:`);
    console.log(`  Cédula: ${user.cedula}`);
    console.log(`  Contraseña: ${user.password}`);
    console.log(`  Esperado: Redirige a /medico/mi-agenda`);
    console.log(`\n⏳ Navega a: http://localhost:5173/login`);
    console.log(`Completa el login manualmente y verifica redirección.`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Usuario autenticado: ${user.nombre}`);
    console.log(`  - Rol: ${user.rol}`);
    console.log(`  - URL actual: /medico/mi-agenda`);
    console.log(`  - Token en localStorage: mock-token-medico-xxxxx`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-003: Login Administrativo Exitoso
  // ─────────────────────────────────────────────────────────────────────────
  async testAuthenticationAdmin() {
    console.log("🧪 TC-003: Login Administrativo Exitoso");
    console.log("─".repeat(60));
    const user = this.testUsers.administrativo;
    console.log(`Intentando login con:`);
    console.log(`  Cédula: ${user.cedula}`);
    console.log(`  Contraseña: ${user.password}`);
    console.log(`  Esperado: Redirige a /admin/dashboard`);
    console.log(`\n⏳ Nota: El admin dashboard aún está comentado en App.jsx`);
    console.log(`Debería redirigir a Principal hasta que se implemente.`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-005: Login Fallido - Cédula Incorrecta
  // ─────────────────────────────────────────────────────────────────────────
  testAuthenticationFailureCedula() {
    console.log("🧪 TC-005: Login Fallido - Cédula Incorrecta");
    console.log("─".repeat(60));
    console.log(`Intentando login con:`);
    console.log(`  Cédula: 9999999999 (INEXISTENTE)`);
    console.log(`  Contraseña: paciente123`);
    console.log(`\n⏳ Navega a: http://localhost:5173/login`);
    console.log(`Completa el login manualmente.`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Mensaje de error: "Credenciales incorrectas..."`);
    console.log(`  - Usuario NO autenticado`);
    console.log(`  - URL sigue siendo: /login`);
    console.log(`  - NO hay token en localStorage`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-006: Login Fallido - Contraseña Incorrecta
  // ─────────────────────────────────────────────────────────────────────────
  testAuthenticationFailurePassword() {
    console.log("🧪 TC-006: Login Fallido - Contraseña Incorrecta");
    console.log("─".repeat(60));
    console.log(`Intentando login con:`);
    console.log(`  Cédula: 1000000001`);
    console.log(`  Contraseña: wrongpassword123 (INCORRECTA)`);
    console.log(`\n⏳ Navega a: http://localhost:5173/login`);
    console.log(`Completa el login manualmente.`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Mensaje de error: "Credenciales incorrectas..."`);
    console.log(`  - Usuario NO autenticado`);
    console.log(`  - URL sigue siendo: /login`);
    console.log(`  - NO hay token en localStorage`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-007: Acceso Denegado - Paciente intenta acceder a ruta médico
  // ─────────────────────────────────────────────────────────────────────────
  testAuthorizationDenialPacienteToMedico() {
    console.log("🧪 TC-007: Acceso Denegado - Paciente → Médico");
    console.log("─".repeat(60));
    console.log(`Pasos:`);
    console.log(`  1. Login como Paciente (${this.testUsers.paciente.cedula})`);
    console.log(`  2. Una vez autenticado, navega directamente a: /medico/mi-agenda`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Redirige automáticamente a / (Principal)`);
    console.log(`  - NO muestra la agenda del médico`);
    console.log(`  - Rol permanece como 'paciente'`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-008: Acceso Denegado - Médico intenta acceder a ruta paciente
  // ─────────────────────────────────────────────────────────────────────────
  testAuthorizationDenialMedicoToPaciente() {
    console.log("🧪 TC-008: Acceso Denegado - Médico → Paciente");
    console.log("─".repeat(60));
    console.log(`Pasos:`);
    console.log(`  1. Login como Médico (${this.testUsers.medico.cedula})`);
    console.log(`  2. Una vez autenticado, navega directamente a: /paciente/dashboard`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Redirige automáticamente a / (Principal)`);
    console.log(`  - NO muestra el dashboard del paciente`);
    console.log(`  - Rol permanece como 'medico'`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-009: Acceso Denegado - Paciente intenta acceder a admin
  // ─────────────────────────────────────────────────────────────────────────
  testAuthorizationDenialPacienteToAdmin() {
    console.log("🧪 TC-009: Acceso Denegado - Paciente → Admin");
    console.log("─".repeat(60));
    console.log(`Pasos:`);
    console.log(`  1. Login como Paciente (${this.testUsers.paciente.cedula})`);
    console.log(`  2. Una vez autenticado, navega directamente a: /admin/dashboard`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Redirige automáticamente a / (Principal)`);
    console.log(`  - NO muestra el panel administrativo`);
    console.log(`  - Rol permanece como 'paciente'`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-010: Acceso Denegado - Sin autenticación
  // ─────────────────────────────────────────────────────────────────────────
  testAuthorizationDenialUnauthenticated() {
    console.log("🧪 TC-010: Acceso Denegado - Sin Autenticación");
    console.log("─".repeat(60));
    console.log(`Pasos:`);
    console.log(`  1. Sin hacer login, abre nuevamente el navegador`);
    console.log(`  2. Intenta acceder directamente a: /paciente/dashboard`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Redirige automáticamente a /login`);
    console.log(`  - Muestra la página de login`);
    console.log(`  - NO hay token en localStorage`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-011: Persistencia de sesión
  // ─────────────────────────────────────────────────────────────────────────
  testSessionPersistence() {
    console.log("🧪 TC-011: Persistencia de Sesión");
    console.log("─".repeat(60));
    console.log(`Pasos:`);
    console.log(`  1. Login como Paciente (${this.testUsers.paciente.cedula})`);
    console.log(`  2. Verifica que estés en /paciente/dashboard`);
    console.log(`  3. Recarga la página (F5 o Ctrl+R)`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Sesión persiste después de reload`);
    console.log(`  - Sigue autenticado como Paciente`);
    console.log(`  - Sigue en /paciente/dashboard (no redirige a login)`);
    console.log(`  - Token se mantiene en localStorage`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TC-012: Logout
  // ─────────────────────────────────────────────────────────────────────────
  testLogout() {
    console.log("🧪 TC-012: Logout");
    console.log("─".repeat(60));
    console.log(`Pasos:`);
    console.log(`  1. Login como Paciente (${this.testUsers.paciente.cedula})`);
    console.log(`  2. Haz clic en "Cerrar Sesión" (logout button)`);
    console.log(`  3. Intenta acceder a /paciente/dashboard`);
    console.log(`\n✅ RESULTADO ESPERADO:`);
    console.log(`  - Redirige automáticamente a /login`);
    console.log(`  - Token se elimina de localStorage`);
    console.log(`  - Usuario NO autenticado`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Verificaciones de Seguridad
  // ─────────────────────────────────────────────────────────────────────────

  checkTokenFormat() {
    console.log("🔍 Verificación: Formato de Token");
    console.log("─".repeat(60));
    const token = localStorage.getItem("auth_token");
    if (!token) {
      console.warn("⚠️  NO hay token en localStorage");
      return;
    }
    console.log(`Token actual: ${token}`);
    const matches = token.match(/^mock-token-(paciente|medico|administrativo|superadministrador)-\d+$/);
    if (matches) {
      console.log("✅ Formato correcto: mock-token-{rol}-{timestamp}");
      console.log(`   Rol extraído: ${matches[1]}`);
    } else {
      console.error("❌ Formato INCORRECTO");
    }
  },

  checkAuthContext() {
    console.log("🔍 Verificación: AuthContext State");
    console.log("─".repeat(60));
    // Nota: Esta función requiere que el componente App esté accesible
    // en devtools. Alternativa: usar React DevTools extension
    console.log("Usa React DevTools para inspeccionar AuthContext en el árbol de componentes.");
    console.log("Verifica:");
    console.log("  - isAuthenticated: true/false");
    console.log("  - rol: paciente/medico/administrativo/superadministrador");
    console.log("  - user: objeto del usuario");
    console.log("  - token: formato mock-token-{rol}-{timestamp}");
  },

  checkProtectedRoute() {
    console.log("🔍 Verificación: ProtectedRoute Behavior");
    console.log("─".repeat(60));
    console.log("Verificar que:");
    console.log("  1. Sin autenticación → Redirige a /login");
    console.log("  2. Con rol incorrecto → Redirige a /");
    console.log("  3. Con rol correcto → Muestra contenido");
    console.log("\nPasos para verificar:");
    console.log("  1. Abre DevTools → Network tab");
    console.log("  2. Intenta acceder a rutas protegidas");
    console.log("  3. Verifica que no haya errores 401/403");
    console.log("  4. Verifica las redirecciones en la URL");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Resumen de Pruebas
  // ─────────────────────────────────────────────────────────────────────────

  runAllTests() {
    console.log("🚀 HU-002: SECURITY TESTING - SUITE COMPLETA");
    console.log("═".repeat(60));
    console.log("\n📋 AUTENTICACIÓN:");
    this.testAuthenticationPaciente();
    console.log("\n");
    this.testAuthenticationMedico();
    console.log("\n");
    this.testAuthenticationFailureCedula();
    console.log("\n");
    this.testAuthenticationFailurePassword();
    console.log("\n📋 AUTORIZACIÓN:");
    this.testAuthorizationDenialPacienteToMedico();
    console.log("\n");
    this.testAuthorizationDenialMedicoToPaciente();
    console.log("\n");
    this.testAuthorizationDenialPacienteToAdmin();
    console.log("\n");
    this.testAuthorizationDenialUnauthenticated();
    console.log("\n📋 PERSISTENCIA:");
    this.testSessionPersistence();
    console.log("\n");
    this.testLogout();
    console.log("\n🔍 VERIFICACIONES:");
    this.checkTokenFormat();
    console.log("\n");
    this.checkProtectedRoute();
  },

  printTestCases() {
    console.log("📚 CASOS DE PRUEBA DISPONIBLES:");
    console.log("═".repeat(60));
    console.log("\n🔓 Autenticación:");
    console.log("  - securityTests.testAuthenticationPaciente()");
    console.log("  - securityTests.testAuthenticationMedico()");
    console.log("  - securityTests.testAuthenticationAdmin()");
    console.log("  - securityTests.testAuthenticationFailureCedula()");
    console.log("  - securityTests.testAuthenticationFailurePassword()");
    console.log("\n🔐 Autorización:");
    console.log("  - securityTests.testAuthorizationDenialPacienteToMedico()");
    console.log("  - securityTests.testAuthorizationDenialMedicoToPaciente()");
    console.log("  - securityTests.testAuthorizationDenialPacienteToAdmin()");
    console.log("  - securityTests.testAuthorizationDenialUnauthenticated()");
    console.log("\n💾 Persistencia:");
    console.log("  - securityTests.testSessionPersistence()");
    console.log("  - securityTests.testLogout()");
    console.log("\n🔍 Verificaciones:");
    console.log("  - securityTests.checkTokenFormat()");
    console.log("  - securityTests.checkAuthContext()");
    console.log("  - securityTests.checkProtectedRoute()");
    console.log("\n▶️  Ejecutar todo:");
    console.log("  - securityTests.runAllTests()");
    console.log("\n" + "═".repeat(60));
  }
};

// Auto-mostrar casos disponibles al cargar
console.log(
  "%c🔐 HU-002 Security Testing Suite Loaded\n" +
  "Escribe: securityTests.printTestCases() para ver todos los casos disponibles",
  "color: #2ecc71; font-weight: bold; font-size: 14px;"
);
