# SaludAgendaX

Sistema web de gestión de citas médicas para clínicas y hospitales. Permite a pacientes agendar, cancelar y reprogramar citas en línea; a médicos consultar su agenda; a personal administrativo gestionar pacientes, médicos y especialidades; y a superadministradores configurar reglas de negocio (topes por EPS, restricciones de frecuencia, sedes, feriados y parámetros globales).

## Tabla de contenido

- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instalación y ejecución local](#instalación-y-ejecución-local)
- [Roles del sistema](#roles-del-sistema)

## Stack tecnológico

**Backend**
- Python 3 · Django 5.2 · Django REST Framework
- Autenticación JWT (`djangorestframework-simplejwt`)
- `django-cors-headers`, `dj-database-url`, `python-decouple`
- Base de datos: SQLite en desarrollo, PostgreSQL en producción (vía `DATABASE_URL`)
- Despliegue actual: [Railway](https://railway.app)

**Frontend**
- React 19 + Vite
- React Router v7
- Tailwind CSS v4
- Axios (cliente HTTP)
- `react-big-calendar` (calendario de citas), `recharts` (gráficas/reportes), `date-fns`

## Instalación y ejecución local

### Requisitos previos
- Python 3.11+
- Node.js 18+ y npm
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/ChorizoMagico/SaludAgendaX.git
cd SaludAgendaX
```

### 2. Backend (Django)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate

pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

El backend queda disponible en `http://localhost:8000/api/`.

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install

npm run dev
```

El frontend queda disponible en `http://localhost:5173`.

## Roles del sistema

| Rol | Puede |
|---|---|
| **Paciente** | Registrarse, iniciar sesión, agendar/cancelar/reprogramar sus citas, ver su historial y calendario, editar su perfil. |
| **Médico** | Autorregistrarse (queda pendiente de aprobación), consultar su propia agenda. |
| **Administrativo** | Autorregistrarse (queda pendiente de aprobación), gestionar pacientes, médicos, especialidades, citas y horarios; ver reportes de ocupación. |
| **Superadministrador** | Aprobar/rechazar solicitudes de registro de médicos y administrativos; configurar topes por EPS, restricciones de frecuencia, sedes, feriados y parámetros globales del sistema; ver alertas de topes próximos a agotarse. |
