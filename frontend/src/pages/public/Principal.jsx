import { useState } from "react";
import { Link } from "react-router-dom";

import cardiologiaImg from "../../img/cardiologia.jpg";
import medicinaGeneralImg from "../../img/general.jpg";
import pediatriaImg from "../../img/pediatria.jpg";
import dermatologiaImg from "../../img/dermatologia.jpg";
import odontologiaImg from "../../img/odontologia.jpg";
import neurologiaImg from "../../img/neurologia.jpg";
import gastroenterologiaImg from "../../img/gastroenterologia.jpg";
import psicologiaImg from "../../img/psicologia.jpg";
import ortopediaImg from "../../img/ortopedia.jpg";
import ginecologiaImg from "../../img/ginecologia.jpg";
import radiologiaImg from "../../img/radiologia.jpg";
import urologiaImg from "../../img/urologia.jpg";
import medicosImg from "../../img/medicos.jpg";

const especialidades = [
  { icon: "cardiology", nombre: "Cardiología", desc: "Prevención, diagnóstico y tratamiento de enfermedades del corazón.", img: cardiologiaImg },
  { icon: "medical_services", nombre: "Medicina general", desc: "Atención primaria, chequeos generales y orientación para remisión a especialistas.", img: medicinaGeneralImg },
  { icon: "child_care", nombre: "Pediatría", desc: "Atención médica integral para niños y adolescentes.", img: pediatriaImg },
  { icon: "healing", nombre: "Dermatología", desc: "Diagnóstico y tratamiento de enfermedades de la piel, cabello y uñas.", img: dermatologiaImg },
{ icon: "dentistry", nombre: "Odontología", desc: "Cuidado dental integral para toda la familia.", img: odontologiaImg },
  { icon: "neurology", nombre: "Neurología", desc: "Especialistas en el sistema nervioso y trastornos cerebrales.", img: neurologiaImg },
  { icon: "nutrition", nombre: "Gastroenterología", desc: "Diagnóstico y tratamiento de enfermedades del sistema digestivo.", img: gastroenterologiaImg },
  { icon: "psychology", nombre: "Psicología", desc: "Acompañamiento en salud mental, terapia individual y manejo emocional.", img: psicologiaImg },
  { icon: "orthopedics", nombre: "Ortopedia", desc: "Cuidado experto de huesos, articulaciones y músculos.", img: ortopediaImg },
  { icon: "female", nombre: "Ginecología", desc: "Atención integral para la salud de la mujer en todas sus etapas.", img: ginecologiaImg },
  { icon: "biotech", nombre: "Radiología", desc: "Diagnóstico preciso mediante tecnología de imagen avanzada.", img: radiologiaImg },
  { icon: "male", nombre: "Urología", desc: "Tratamientos quirúrgicos y médicos del sistema urinario.", img: urologiaImg },
];

const pasos = [
  { n: 1, titulo: "Crea tu cuenta", desc: "Regístrate con tus datos y tu EPS. Es gratis y toma menos de 3 minutos." },
  { n: 2, titulo: "Elige especialidad y horario", desc: "Consulta la disponibilidad real de cada médico y elige la franja que prefieras." },
  { n: 3, titulo: "Confirma y listo", desc: "Recibirás confirmación por correo y un recordatorio 24 horas antes." },
];

const accesos = [
  {
    icon: "person",
    titulo: "Pacientes",
    desc: "Regístrate con tus datos y tu EPS para empezar a agendar citas.",
    to: "/registro?rol=paciente",
  },
  {
    icon: "stethoscope",
    titulo: "Profesionales de la salud",
    desc: "Consulta tu agenda, revisa tu disponibilidad y administra tus citas asignadas.",
    to: "/registro?rol=medico",
  },
  {
    icon: "admin_panel_settings",
    titulo: "Administrativo",
    desc: "Gestiona médicos, especialidades, agendamiento y pacientes del sistema.",
    to: "/registro?rol=administrativo",
  },
  {
    icon: "shield_person",
    titulo: "Superadministrador",
    desc: "Configura reglas de negocio, topes por EPS y parámetros globales del sistema.",
    to: "/registro?rol=superadministrador",
  },
];

// Enlace de navegación desktop: solo se resalta al pasar el mouse, sin desplazar el layout
// (el borde inferior siempre ocupa espacio, pero es transparente hasta el hover)
function NavLink({ href, children, onClick }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="text-[#48605C] hover:text-[#0F3D3E] hover:font-bold border-b-2 border-transparent hover:border-[#0E9668] pb-1 transition-colors duration-200"
    >
      {children}
    </a>
  );
}

// Tarjeta de especialidad: foto de fondo + nombre siempre visible.
// En desktop, la descripción vive oculta y se revela con el hover del grupo.
// En mobile no hay hover real (touch), así que la descripción se muestra
// siempre, en tamaño reducido, desde el arranque (md:text-white/0 la oculta
// de nuevo en pantallas medianas en adelante hasta que haya hover).
function EspecialidadCard({ icon, nombre, desc, img }) {
  return (
    <div className="group relative h-52 sm:h-60 rounded-lg overflow-hidden cursor-pointer shadow-sm">
      <img
        src={img}
        alt={nombre}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 md:group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5 md:via-black/25 md:to-black/0 md:group-hover:from-black/90 md:group-hover:via-black/50 transition-all duration-300" />

      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-white text-xl sm:text-2xl">{icon}</span>
          <h3 className="text-white font-semibold text-base sm:text-lg leading-tight">{nombre}</h3>
        </div>
        <p className="text-white/90 md:text-white/0 md:group-hover:text-white/90 text-xs leading-relaxed max-h-24 md:max-h-0 md:group-hover:max-h-24 overflow-hidden transition-all duration-300">
          {desc}
        </p>
      </div>
    </div>
  );
}

export default function Principal() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  return (
    <div className="text-[16px] text-[#1A2624]">
      {/* Header */}
      <header className="bg-white border-b border-[#DCE8E5] fixed top-0 w-full z-50">
        <nav className="max-w-[1200px] mx-auto px-4 md:px-20 flex justify-between items-center h-16 md:h-20">
          <div className="flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[#0E9668] text-2xl md:text-3xl">stethoscope</span>
            <span className="text-xl md:text-2xl font-bold text-[#0F3D3E]">SaludAgendaX</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <NavLink href="#acceso">Registrarme</NavLink>
            <NavLink href="#especialidades">Especialidades</NavLink>
            <NavLink href="#como-funciona">Cómo funciona</NavLink>
          </div>

          <div className="flex items-center gap-2">
            {/* Único botón de acción visible siempre: login */}
            <Link
              to="/login"
              className="hidden sm:inline-block bg-[#0E9668] text-white px-5 py-2.5 rounded font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              Iniciar sesión
            </Link>

            {/* Botón hamburguesa — solo mobile */}
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuAbierto}
              className="md:hidden text-[#0F3D3E] p-2 -mr-2"
            >
              <span className="material-symbols-outlined text-3xl">
                {menuAbierto ? "close" : "menu"}
              </span>
            </button>
          </div>
        </nav>

        {/* Panel desplegable — solo mobile */}
        {menuAbierto && (
          <div className="md:hidden border-t border-[#DCE8E5] bg-white px-4 py-4 flex flex-col gap-4">
            <NavLink href="#acceso" onClick={cerrarMenu}>Registrarme</NavLink>
            <NavLink href="#especialidades" onClick={cerrarMenu}>Especialidades</NavLink>
            <NavLink href="#como-funciona" onClick={cerrarMenu}>Cómo funciona</NavLink>
            <Link
              to="/login"
              onClick={cerrarMenu}
              className="sm:hidden bg-[#0E9668] text-white px-5 py-2.5 rounded font-semibold text-center hover:bg-[#0C7D57] transition-colors duration-200"
            >
              Iniciar sesión
            </Link>
          </div>
        )}
      </header>

      <main className="mt-16 md:mt-20">
        {/* Hero: un solo llamado a la acción, sin duplicar lo del header */}
        <section className="relative min-h-[400px] sm:min-h-[440px] flex items-center overflow-hidden bg-[#E7F5F3]">
          <div className="absolute inset-0 z-0">
            <img
              alt="Personal médico atendiendo a un paciente"
              className="w-full h-full object-cover"
              src={medicosImg}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0F3D3E]/70 via-[#0F3D3E]/40 to-[#0F3D3E]/15" />
          </div>
          <div className="relative z-10 max-w-[1200px] mx-auto px-4 md:px-20 w-full py-10">
            <div className="max-w-2xl text-white">
              <span className="inline-block bg-white/15 backdrop-blur-sm text-white text-[10px] sm:text-xs uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                Sistema de gestión de citas médicas
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight">
                Agenda tu cita médica sin filas ni llamadas
              </h1>
              <p className="text-base sm:text-lg mb-8 opacity-95 max-w-lg">
                Consulta la disponibilidad de tu médico en tiempo real, agenda según tu EPS y gestiona tus citas desde cualquier dispositivo.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                <Link
                  to="/login"
                  className="text-center bg-[#0E9668] text-white px-6 py-3.5 sm:px-8 sm:py-4 rounded font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                >
                  Iniciar sesión
                </Link>
                <a
                  href="#acceso"
                  className="text-center border-2 border-white text-white px-6 py-3.5 sm:px-8 sm:py-4 rounded font-semibold hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Registrarme
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Acceso por tipo de usuario */}
        <section id="acceso" className="max-w-[1200px] mx-auto px-4 md:px-20 -mt-10 sm:-mt-14 relative z-20 pt-16 pb-6 scroll-mt-16 md:scroll-mt-20">
          <div className="bg-white border border-[#DCE8E5] rounded-lg shadow-sm p-5 sm:p-8 md:p-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#0F3D3E] mb-2">Bienvenido a SaludAgendaX</h2>
            <p className="text-[#48605C] mb-8 sm:mb-10">Elige tu tipo de usuario para registrarte.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {accesos.map((a) => (
                <div
                  key={a.titulo}
                  className="border border-[#DCE8E5] rounded-lg p-6 flex flex-col hover:border-[#0E9668] hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-[#0E9668] text-3xl mb-3">{a.icon}</span>
                  <h3 className="text-lg font-semibold text-[#0F3D3E] mb-2">{a.titulo}</h3>
                  <p className="text-sm text-[#48605C] mb-6 flex-1">{a.desc}</p>
                  <Link
                    to={a.to}
                    className="bg-[#0E9668] text-white px-5 py-3 rounded font-semibold text-center hover:bg-[#0C7D57] transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    Registrarme
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Especialidades */}
        <section id="especialidades" className="pt-6 pb-16 max-w-[1200px] mx-auto px-4 md:px-20 scroll-mt-16 md:scroll-mt-20">
          <div className="mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#0F3D3E] border-l-4 border-[#0E9668] pl-4">Especialidades médicas</h2>
            <p className="text-[#48605C] mt-2 text-sm sm:text-base">
              Estas son las especialidades médicas ofrecidas por la institución.
              <span className="hidden md:inline"> Pasa el mouse sobre cada una para más información.</span>
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {especialidades.map((e) => (
              <EspecialidadCard key={e.nombre} {...e} />
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="py-12 sm:py-16 bg-[#F3F8F7] border-y border-[#DCE8E5] scroll-mt-16 md:scroll-mt-20">
          <div className="max-w-[1200px] mx-auto px-4 md:px-20">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#0F3D3E] border-l-4 border-[#0E9668] pl-4 mb-8 sm:mb-12">Cómo funciona</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {pasos.map((p) => (
                <div
                  key={p.n}
                  className="bg-white p-6 sm:p-8 rounded-lg border border-[#DCE8E5] hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-full bg-[#D3F3E6] text-[#0E9668] flex items-center justify-center font-bold mb-4">
                    {p.n}
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F3D3E] mb-2">{p.titulo}</h3>
                  <p className="text-[#48605C]">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer simplificado */}
      <footer className="bg-[#E5EFEC] border-t border-[#DCE8E5]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-20 py-10 sm:py-12">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="text-xl sm:text-2xl font-bold text-[#0F3D3E]">SaludAgendaX</div>
            <p className="text-[#48605C] max-w-md text-sm sm:text-base">
              Sistema de gestión de citas médicas.
            </p>
            <span className="text-xs text-[#48605C] mt-6">
              © 2026 SaludAgendaX · Universidad del Valle · Desarrollo de Software I
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}