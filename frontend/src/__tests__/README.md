# HU-002: Testing de Seguridad - Guía de Ejecución

## Descripción

Plan de testing de seguridad para validar:
- **Autenticación**: Login exitoso/fallido con diferentes roles
- **Autorización**: Restricción de acceso por rol
- **Persistencia de sesión**: Mantención de autenticación después de reload
- **Logout**: Limpieza de sesión

##  Estructura de Pruebas

```
__tests__/
├── HU-002-Checklist.md          # Plan detallado de pruebas manuales
├── TestsUnitariosAutenticacion.test.jsx               # Tests unitarios para autenticación
├── TestsUnitariosAutorizacionRestriccion.test.jsx            # Tests unitarios para autorización
├── hu-002-security-tests.js           # Script interactivo para consola del navegador
└── README.md                          # Este archivo
```

##  Usuarios de Prueba

### Paciente
- **Cédula**: 1000000001
- **Contraseña**: paciente123
- **Nombre**: Valeria Restrepo
- **Ruta autorizada**: /paciente/dashboard

### Médico
- **Cédula**: 1000000002
- **Contraseña**: medico123
- **Nombre**: Andrés Mejía
- **Ruta autorizada**: /medico/mi-agenda

### Administrativo
- **Cédula**: 1000000003
- **Contraseña**: admin123
- **Nombre**: Laura Gómez
- **Ruta autorizada**: /admin/dashboard (comentado en App.jsx)

### Superadministrador
- **Cédula**: 1000000004
- **Contraseña**: super123
- **Nombre**: Carlos Ríos
- **Ruta autorizada**: /admin/dashboard (comentado en App.jsx)

##  Cómo ejecutar las pruebas

### Opción 1: Tests Interactivos en Consola del Navegador

1. Abre la aplicación en el navegador: http://localhost:5173
2. Abre DevTools (F12) → Tab "Console"
3. Copia el contenido de `hu-002-security-tests.js` en la consola
4. Ejecuta los casos de prueba:

```javascript
// Ver todos los casos disponibles
securityTests.printTestCases()

// Ejecutar un caso específico (ej: TC-001)
securityTests.testAuthenticationPaciente()

// Ejecutar toda la suite
securityTests.runAllTests()
```

### Opción 2: Tests Unitarios (Vitest/Jest)

```bash
# Instala dependencias de testing (si no está hecho)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# Ejecuta los tests
npm run test

# O modo watch para desarrollo
npm run test -- --watch
```

### Opción 3: Tests Manuales desde el Navegador

Sigue los pasos descritos en `HU-002-SecurityTesting.md` (casos TC-001 a TC-012)

##  Casos de Prueba

### Autenticación (TC-001 a TC-006)

| Caso | Descripción | Usuario | Resultado Esperado |
|------|-------------|---------|-------------------|
| TC-001 | Login Paciente exitoso | 1000000001/paciente123 | Redirige a /paciente/dashboard |
| TC-002 | Login Médico exitoso | 1000000002/medico123 | Redirige a /medico/mi-agenda |
| TC-003 | Login Admin exitoso | 1000000003/admin123 | Redirige a /admin/dashboard |
| TC-004 | Login SuperAdmin exitoso | 1000000004/super123 | Redirige a /admin/dashboard |
| TC-005 | Login falla - cédula incorrecta | 9999999999/paciente123 | Muestra error "Credenciales incorrectas" |
| TC-006 | Login falla - contraseña incorrecta | 1000000001/wrongpass | Muestra error "Credenciales incorrectas" |

### Autorización (TC-007 a TC-010)

| Caso | Descripción | Usuario | Intenta Acceder | Resultado Esperado |
|------|-------------|---------|-----------------|-------------------|
| TC-007 | Paciente → Médico | Paciente | /medico/mi-agenda | Redirige a / |
| TC-008 | Médico → Paciente | Médico | /paciente/dashboard | Redirige a / |
| TC-009 | Paciente → Admin | Paciente | /admin/dashboard | Redirige a / |
| TC-010 | Sin autenticación | N/A | /paciente/dashboard | Redirige a /login |

### Persistencia (TC-011 a TC-012)

| Caso | Descripción | Pasos | Resultado Esperado |
|------|-------------|-------|-------------------|
| TC-011 | Sesión persiste | 1. Login 2. F5 | Sigue autenticado sin redirigir a login |
| TC-012 | Logout limpia sesión | 1. Login 2. Logout 3. Intenta acceder | Redirige a /login, no hay token |

##  Criterios de Aceptación

### CA-1: Autenticación exitosa
- [ ] Todos los roles (paciente, médico, admin, super) pueden iniciar sesión
- [ ] Token se genera en formato correcto: `mock-token-{rol}-{timestamp}`
- [ ] Usuario se guarda en contexto correctamente

### CA-2: Autenticación fallida
- [ ] Credenciales inválidas muestran error
- [ ] Usuario NO se autentica
- [ ] NO se genera token

### CA-3: Acceso protegido por rol
- [ ] Cada rol accede a su ruta autorizada
- [ ] No autenticado → redirige a /login

### CA-4: Restricción de acceso
- [ ] Paciente NO puede ver rutas médico/admin
- [ ] Médico NO puede ver rutas paciente/admin
- [ ] Admin/Super NO pueden ver rutas paciente/médico

### CA-5: Persistencia
- [ ] Token se guarda en localStorage
- [ ] Sesión se mantiene después de reload
- [ ] Logout limpia token y contexto

### CA-6: Token válido
- [ ] Formato: `mock-token-{rol}-{timestamp}`
- [ ] Se guarda/recupera correctamente
- [ ] Expira/invalida apropiadamente

## 🔍 Verificaciones Técnicas

```javascript
// En la consola, después de hacer login:

// Verificar token
localStorage.getItem("auth_token")
// Esperado: "mock-token-paciente-1234567890"

// Verificar formato
const token = localStorage.getItem("auth_token");
token.match(/^mock-token-(paciente|medico|administrativo|superadministrador)-\d+$/)
// Esperado: Array con el rol extraído

// Verificar URL actual
window.location.pathname
// Esperado: /paciente/dashboard (o ruta según rol)
```

##  Solución de Problemas

### El login no funciona
1. Verifica la consola del navegador (F12 → Console)
2. Comprueba que la cédula y contraseña sean exactas
3. Verifica que `AuthContext` está usando `USE_MOCK = true`

### La redireccionamiento no funciona
1. Verifica que `ProtectedRoute` está validando `rolesPermitidos`
2. Revisa que el `isAuthenticated` y `rol` se actualizan después del login
3. Comprueba que React Router está configurado correctamente

### El token no persiste después de reload
1. Verifica que `localStorage` está activo (no deshabilitado)
2. Comprueba que `AuthContext` guarda el token en `localStorage.setItem()`
3. Verifica que al cargar la app, lee el token de `localStorage.getItem()`

### Tests unitarios no corren
1. Instala dependencias: `npm install --save-dev vitest @testing-library/react`
2. Verifica que las dependencias estén en `package.json`
3. Corre: `npm run test`

##  Reportar Resultados

Completa la tabla de evidencia en `HU-002-SecurityTesting.md`:

```markdown
| Caso | Resultado | Observaciones | Timestamp |
|------|-----------|---------------|-----------|
| TC-001 | ✅ PASS | Paciente login exitoso | 2026-07-14 14:30 |
| TC-002 | ✅ PASS | Médico login exitoso | 2026-07-14 14:35 |
| ... | ... | ... | ... |
```

##  Recursos Adicionales

- **AuthContext.jsx**: Lógica de autenticación con mock
- **ProtectedRoute.jsx**: Componente que valida autenticación y rol
- **mockData.jsx**: Usuarios de prueba y datos simulados
- **App.jsx**: Definición de rutas protegidas por rol

##  Estado Actual

- ✅ Documentación de pruebas completada
- ✅ Tests unitarios estructurados
- ✅ Script interactivo para consola
- ⏳ Ejecución de pruebas manual/automatizada

##  Siguiente Paso

1. Ejecutar los tests interactivos desde la consola
2. Documentar los resultados
3. Ajustar `AuthContext` y `ProtectedRoute` si es necesario
4. Crear tickets para features faltantes (ej: admin dashboard)

---

**Creado**: 2026-07-14 | **Historia**: HU-002 | **Sprint**: Security Testing
