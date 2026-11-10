import { useEffect, useRef, useState, type ReactNode } from 'react';
import logo from '../recursos/logo-turnocare.png';

/**
 * Portada de presentación: lo primero que se ve al abrir la app.
 * Tres diapositivas (inicio con el lema, misión y visión) y el botón para ir al ingreso.
 */

const DIAPOSITIVAS = [
  { id: 'inicio', texto: 'Inicio' },
  { id: 'mision', texto: 'Misión' },
  { id: 'vision', texto: 'Visión' },
] as const;

type IdDiapositiva = (typeof DIAPOSITIVAS)[number]['id'];

const PILARES_MISION: { icono: ReactNode; titulo: string; texto: string }[] = [
  { icono: <IconoBalanza />, titulo: 'Carga equitativa', texto: 'Distribución justa de jornadas y descansos.' },
  { icono: <IconoCorazon />, titulo: 'Bienestar del talento humano', texto: 'Cuidamos a quienes cuidan.' },
  { icono: <IconoEscudo />, titulo: 'Atención de calidad', texto: 'Segura, oportuna y humanizada.' },
  { icono: <IconoGrafica />, titulo: 'Indicadores para decidir', texto: 'Sobrecargas, ausentismo y cobertura a la vista.' },
];

const PILARES_VISION: { icono: ReactNode; titulo: string }[] = [
  { icono: <IconoUbicacion />, titulo: 'Líder en Colombia' },
  { icono: <IconoChispa />, titulo: 'Inteligencia artificial responsable' },
  { icono: <IconoGrafica />, titulo: 'Decisiones basadas en información' },
];

export function Portada({ alIngresar }: { alIngresar: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState<IdDiapositiva>('inicio');
  const [vistas, setVistas] = useState<Set<IdDiapositiva>>(new Set(['inicio']));

  // Marca la diapositiva visible (para los puntos de navegación) y anima su entrada la primera vez.
  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.id as IdDiapositiva;
          setActual(id);
          setVistas((v) => (v.has(id) ? v : new Set(v).add(id)));
        }
      },
      { root: raiz, threshold: 0.55 },
    );
    raiz.querySelectorAll('[data-id]').forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, []);

  // Teclado como en una presentación: flechas y Av/Re Pág cambian de diapositiva; Enter ingresa.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const i = DIAPOSITIVAS.findIndex((d) => d.id === actual);
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key) && i < DIAPOSITIVAS.length - 1) {
        e.preventDefault();
        ir(DIAPOSITIVAS[i + 1].id);
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key) && i > 0) {
        e.preventDefault();
        ir(DIAPOSITIVAS[i - 1].id);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        alIngresar();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [actual, alIngresar]);

  const ir = (id: IdDiapositiva) => {
    contenedor.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth' });
  };

  const clase = (id: IdDiapositiva, extra = '') => `diapo ${extra} ${vistas.has(id) ? 'visible' : ''}`;

  return (
    <div className="portada">
      <header className="portada-barra">
        <button className="portada-marca" onClick={() => ir('inicio')} aria-label="Ir al inicio">
          Turno<b>Care</b>
        </button>
        <nav aria-label="Secciones">
          {DIAPOSITIVAS.map((d) => (
            <button key={d.id} className={actual === d.id ? 'activo' : ''} onClick={() => ir(d.id)}>
              {d.texto}
            </button>
          ))}
        </nav>
        <button className="portada-ingresar" onClick={alIngresar}>
          Ingresar
        </button>
      </header>

      <div className="portada-diapositivas" ref={contenedor}>
        {/* 1 · Logo y lema */}
        <section data-id="inicio" className={clase('inicio', 'diapo-inicio')} aria-label="Inicio">
          <div className="halo" aria-hidden="true" />
          <img className="portada-logo" src={logo} alt="TurnoCare" />
          <p className="portada-etiqueta">Gestión inteligente de turnos de enfermería</p>
          <h1 className="portada-lema">
            Cuidando a quienes <em>cuidan</em>
          </h1>
          <div className="portada-acciones">
            <button className="portada-boton" onClick={alIngresar} autoFocus>
              Ingresar a TurnoCare
            </button>
            <button className="portada-boton secundario" onClick={() => ir('mision')}>
              Conoce nuestra misión <IconoFlecha />
            </button>
          </div>
        </section>

        {/* 2 · Misión */}
        <section data-id="mision" className={clase('mision')} aria-labelledby="titulo-mision">
          <div className="diapo-rejilla">
            <div className="diapo-encabezado">
              <span className="diapo-numero">01</span>
              <h2 id="titulo-mision">Misión</h2>
              <p className="diapo-destacado">
                Brindar una solución tecnológica innovadora que permita optimizar la organización y gestión de los turnos del personal de
                enfermería, promoviendo una distribución equitativa de la carga laboral, el bienestar del talento humano y una atención
                segura, oportuna, humanizada y de calidad para los pacientes.
              </p>
            </div>
            <div className="diapo-detalle">
              <p>
                A través de TurnoCare, buscamos facilitar la planificación de los horarios mediante herramientas digitales e inteligentes
                que tengan en cuenta las necesidades de los servicios de salud, la disponibilidad del personal, las jornadas laborales y
                los tiempos de descanso. Asimismo, buscamos apoyar la labor de las enfermeras coordinadoras mediante indicadores que
                permitan identificar sobrecargas, ausentismo, dificultades de cobertura y una distribución inadecuada del personal,
                favoreciendo una gestión más eficiente y una mejor toma de decisiones. De esta manera, contribuimos al fortalecimiento de
                los servicios de enfermería y al cuidado integral tanto del paciente como del personal que brinda la atención.
              </p>
              <ul className="pilares">
                {PILARES_MISION.map((p) => (
                  <li key={p.titulo}>
                    <span className="pilar-icono">{p.icono}</span>
                    <div>
                      <b>{p.titulo}</b>
                      <small>{p.texto}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 3 · Visión */}
        <section data-id="vision" className={clase('vision', 'diapo-vision')} aria-labelledby="titulo-vision">
          <div className="diapo-rejilla">
            <div className="diapo-encabezado">
              <span className="diapo-numero">02</span>
              <h2 id="titulo-vision">Visión</h2>
              <div className="anio" aria-hidden="true">
                2030
              </div>
              <ul className="pilares en-linea">
                {PILARES_VISION.map((p) => (
                  <li key={p.titulo}>
                    <span className="pilar-icono">{p.icono}</span>
                    <b>{p.titulo}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="diapo-detalle">
              <p className="diapo-destacado">
                Para el año 2030, ser una plataforma tecnológica líder en Colombia en la gestión inteligente de turnos del personal de
                enfermería y consolidarnos como una herramienta de apoyo para las instituciones de salud en la organización eficiente de
                su talento humano.
              </p>
              <p>
                Buscamos ser reconocidos por la innovación, el uso responsable de la inteligencia artificial y la generación de
                indicadores que permitan tomar decisiones oportunas y basadas en información. TurnoCare pretende contribuir a una
                distribución más equitativa de las jornadas laborales, al bienestar del personal de enfermería y al fortalecimiento de
                servicios de salud más eficientes, seguros, humanizados y centrados en las necesidades de los pacientes.
              </p>
              <div className="cierre">
                <span>
                  Cuidando a quienes <em>cuidan</em>
                </span>
                <button className="portada-boton" onClick={alIngresar}>
                  Ingresar a TurnoCare
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <nav className={`portada-puntos ${actual === 'vision' ? 'oscuro' : ''}`} aria-label="Diapositivas">
        {DIAPOSITIVAS.map((d) => (
          <button
            key={d.id}
            className={actual === d.id ? 'activo' : ''}
            onClick={() => ir(d.id)}
            aria-label={d.texto}
            aria-current={actual === d.id ? 'step' : undefined}
          />
        ))}
      </nav>
    </div>
  );
}

/* Íconos de trazo, en línea para no depender de archivos externos. */
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function IconoBalanza() {
  return (
    <Icono>
      <path d="M12 3v18M5 21h14M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
    </Icono>
  );
}
function IconoCorazon() {
  return (
    <Icono>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </Icono>
  );
}
function IconoEscudo() {
  return (
    <Icono>
      <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icono>
  );
}
function IconoGrafica() {
  return (
    <Icono>
      <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />
    </Icono>
  );
}
function IconoUbicacion() {
  return (
    <Icono>
      <path d="M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </Icono>
  );
}
function IconoChispa() {
  return (
    <Icono>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </Icono>
  );
}
function IconoFlecha() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}
