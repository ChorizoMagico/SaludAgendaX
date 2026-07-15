# HU-002: Testing de Seguridad - Autenticación y Autorización

## Descripción
Validar que el sistema de autenticación y autorización funciona correctamente con diferentes roles de usuario (paciente, médico, administrativo, superadministrador).

## Criterios de Aceptación

### CA-1: Autenticación exitosa con credenciales válidas
- [ Y ] Paciente puede iniciar sesión con cédula `1000000001` y contraseña `paciente123`
- [ Y ] Médico puede iniciar sesión con cédula `1000000002` y contraseña `medico123`
- [ Y ] Administrativo puede iniciar sesión con cédula `1000000003` y contraseña `admin123`
- [ Y ] Superadministrador puede iniciar sesión con cédula `1000000004` y contraseña `super123`
- [ X ] Token se genera correctamente en formato `mock-token-{rol}-{timestamp}`
- [ ? ] Usuario se guarda en el contexto después del login

### CA-2: Autenticación fallida con credenciales inválidas
- [ Y ] Login rechaza cédula inexistente
- [ Y ] Login rechaza contraseña incorrecta
- [ Y ] Se muestra mensaje de error: "Credenciales incorrectas. Verifica tu documento de identidad y contraseña."
- [ Y ] Usuario NO se autentica ni obtiene token

### CA-3: Acceso a rutas protegidas según rol
- [ Y ] Paciente autenticado accede a `/paciente/dashboard`
- [ Y ] Médico autenticado accede a `/medico/mi-agenda`
- [ Y ] Administrativo autenticado accede a `/admin/dashboard`
- [ Y ] Superadministrador autenticado accede a `/admin/dashboard`
- [ X ] Usuario no autenticado es redirigido a `/login` al intentar acceder a rutas protegidas

### CA-4: Restricción de acceso por rol
- [ Y ] Paciente NO puede acceder a `/medico/mi-agenda` (redirige a `/`)
- [ ? ] Paciente NO puede acceder a `/admin/dashboard` (redirige a `/`)
- [ Y ] Médico NO puede acceder a `/paciente/dashboard` (redirige a `/`)
- [ Y ] Médico NO puede acceder a `/admin/dashboard` (redirige a `/`)
- [ ? ] Administrativo NO puede acceder a `/paciente/dashboard` (redirige a `/`)
- [ ? ] Administrativo NO puede acceder a `/medico/mi-agenda` (redirige a `/`)

### CA-5: Persistencia de sesión
- [ X ] Token se almacena en localStorage/sessionStorage
- [ Y ] Usuario permanece autenticado después de recargar página
- [ X ] Sesión se limpia al hacer logout
- [ X ] Token inválido redirige a login

### CA-6: Registro con validación
- [ ? ] Nuevo paciente se registra exitosamente
- [ ? ] Nuevo médico se registra exitosamente (admin)
- [ ? ] Registro rechaza cédula duplicada
- [ ? ] Se muestra error: "Ya existe una cuenta registrada con esas credenciales."
- [ ? ] Registro valida campos obligatorios

## Datos de Prueba

### Usuarios Paciente
| Cédula | Contraseña | Nombre | Rol |
|--------|-----------|--------|-----|
| 1000000001 | paciente123 | Valeria Restrepo | paciente |
| 1000000005 | paciente123 | Ana Martínez | paciente |

### Usuarios Médico
| Cédula | Contraseña | Nombre | Especialidad | Rol |
|--------|-----------|--------|-------------|-----|
| 1000000002 | medico123 | Andrés Mejía | Cardiología | medico |
| 1000000006 | medico123 | Laura Gómez | Medicina general, Pediatría | medico |
| 1000000007 | medico123 | Camila Torres | Dermatología | medico |

### Usuarios Administrativo
| Cédula | Contraseña | Nombre | Rol |
|--------|-----------|--------|-----|
| 1000000003 | admin123 | Laura Gómez | administrativo |

### Usuarios Superadministrador
| Cédula | Contraseña | Nombre | Rol |
|--------|-----------|--------|-----|
| 1000000004 | super123 | Carlos Ríos | superadministrador |

## Casos de Prueba Manual

### TC-001: Login Paciente Exitoso
1. Navegar a `/login`
2. Ingresar cédula: `1000000001`
3. Ingresar contraseña: `paciente123`
4. Hacer clic en "Iniciar Sesión"
5. **Esperado**: Redirige a `/paciente/dashboard` y muestra datos del paciente

### TC-002: Login Médico Exitoso
1. Navegar a `/login`
2. Ingresar cédula: `1000000002`
3. Ingresar contraseña: `medico123`
4. Hacer clic en "Iniciar Sesión"
5. **Esperado**: Redirige a `/medico/mi-agenda` y muestra agenda del médico

### TC-003: Login Administrativo Exitoso
1. Navegar a `/login`
2. Ingresar cédula: `1000000003`
3. Ingresar contraseña: `admin123`
4. Hacer clic en "Iniciar Sesión"
5. **Esperado**: Redirige a `/admin/dashboard` y muestra panel administrativo

### TC-004: Login Superadministrador Exitoso
1. Navegar a `/login`
2. Ingresar cédula: `1000000004`
3. Ingresar contraseña: `super123`
4. Hacer clic en "Iniciar Sesión"
5. **Esperado**: Redirige a `/admin/dashboard` y muestra panel de superadmin

### TC-005: Login Fallido - Cédula Incorrecta
1. Navegar a `/login`
2. Ingresar cédula: `9999999999`
3. Ingresar contraseña: `paciente123`
4. Hacer clic en "Iniciar Sesión"
5. **Esperado**: Muestra error "Credenciales incorrectas..."

### TC-006: Login Fallido - Contraseña Incorrecta
1. Navegar a `/login`
2. Ingresar cédula: `1000000001`
3. Ingresar contraseña: `wrongpassword`
4. Hacer clic en "Iniciar Sesión"
5. **Esperado**: Muestra error "Credenciales incorrectas..."

### TC-007: Acceso Denegado - Paciente intenta acceder a ruta médico
1. Iniciar sesión como paciente (`1000000001` / `paciente123`)
2. Intentar navegar directamente a `/medico/mi-agenda`
3. **Esperado**: Redirige a `/` (Principal)

### TC-008: Acceso Denegado - Médico intenta acceder a ruta paciente
1. Iniciar sesión como médico (`1000000002` / `medico123`)
2. Intentar navegar directamente a `/paciente/dashboard`
3. **Esperado**: Redirige a `/` (Principal)

### TC-009: Acceso Denegado - Paciente intenta acceder a admin FALLA
1. Iniciar sesión como paciente (`1000000001` / `paciente123`)
2. Intentar navegar directamente a `/admin/dashboard`
3. **Esperado**: Redirige a `/` (Principal)


### TC-010: Acceso Denegado - Sin autenticación FALLA
1. Intentar acceder directamente a `/paciente/dashboard` sin iniciar sesión
2. **Esperado**: Redirige a `/login`

### TC-011: Persistencia de sesión 
1. Iniciar sesión como paciente (`1000000001` / `paciente123`)
2. Recargar la página (F5)
3. **Esperado**: Sesión persiste, sigue en `/paciente/dashboard`

### TC-012: Logout FALLA
1. Iniciar sesión como paciente
2. Hacer clic en "Cerrar Sesión"
3. Intentar acceder a `/paciente/dashboard`
4. **Esperado**: Redirige a `/login`

## Flujo de Prueba Recomendado

1. **Pruebas de Autenticación** (TC-001 a TC-006)
   - Validar login exitoso para cada rol
   - Validar rechazo de credenciales inválidas

2. **Pruebas de Autorización** (TC-007 a TC-010)
   - Validar acceso a rutas permitidas
   - Validar bloqueo de acceso a rutas no permitidas

3. **Pruebas de Persistencia** (TC-011, TC-012)
   - Validar mantención de sesión
   - Validar limpieza al logout

## Validación de Código

- [ ] `AuthContext.jsx` valida credenciales contra `MOCK_USERS`
- [ ] `ProtectedRoute.jsx` verifica autenticación y rol
- [ ] Tokens se generan con formato correcto
- [ ] Estados de carga se manejan correctamente (no errores por undefined)
- [ ] Redirecciones funcionan sin errores en consola

## Evidencia de Prueba

| Caso | Resultado | Observaciones | Timestamp |
|------|-----------|---------------|-----------|
| TC-001 | ✓ | | |
| TC-002 | ✓ | | |
| TC-003 | ✓ | | |
| TC-004 | ✓ | | |
| TC-005 | ✓ | | |
| TC-006 | ✓ | | |
| TC-007 | ✓ | | |
| TC-008 | ✓ | | |
| TC-009 | ✗ | | | No redirige al login
| TC-010 | ✗ | | | No redirige al login
| TC-011 | ✓ | | |
| TC-012 | ✗ | | | No redirige al login, accede al dashboard del ultimo paciente y tambien puede acceder al dashboard de medico

## Status
- **Creado**: 2026-07-14
- **Última Actualización**: 2026-07-14
- **Estado**: En Ejecución
