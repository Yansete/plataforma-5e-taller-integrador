import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { catalogService, preferencesService } from '../services';
import { Icon, type IconName } from './Icon';
import { ConfirmDialog } from './ui';

export const ROUTES: { to: string; label: string; icon: IconName; step?: number; title: string }[] = [
  { to: '/', label: 'Inicio', icon: 'home', title: 'Inicio del docente' },
  { to: '/carga', label: 'Carga de material', icon: 'upload', step: 1, title: 'Carga de material' },
  { to: '/configuracion', label: 'Configuración', icon: 'sliders', step: 2, title: 'Configuración de la generación' },
  { to: '/revision', label: 'Revisión docente', icon: 'review', step: 3, title: 'Revisión docente' },
  { to: '/exportacion', label: 'Exportación', icon: 'export', step: 4, title: 'Exportación' },
  { to: '/indicadores', label: 'Indicadores', icon: 'chart', title: 'Tablero de indicadores' },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const course = catalogService.getCourse();

  const firstRender = useRef(true);

  // Al cambiar de pantalla: cerrar el menú, actualizar el título y llevar el foco al encabezado.
  // En la carga inicial no se mueve el foco, para que el primer Tab llegue a «Saltar al contenido».
  useEffect(() => {
    setMenuOpen(false);
    const route = ROUTES.find((r) => r.to === location.pathname);
    document.title = `${route?.title ?? 'Página no encontrada'} · Plataforma 5E`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>('[data-page-title]');
    heading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleReset = () => {
    preferencesService.resetDemo();
    setConfirmReset(false);
    navigate('/');
  };

  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="app">
        <div className="mobile-bar">
          <span className="mobile-bar__title">Plataforma 5E</span>
          <button
            ref={menuButtonRef}
            type="button"
            className="mobile-bar__menu"
            aria-expanded={menuOpen}
            aria-controls="navegacion"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
            Menú
          </button>
        </div>

        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

        <nav id="navegacion" className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'} aria-label="Navegación principal">
          <button
            ref={closeButtonRef}
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menú"
            onClick={() => {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }}
          >
            <Icon name="x" />
          </button>
          <div className="sidebar__brand">
            <span className="sidebar__brand-name">Plataforma 5E</span>
            <span className="sidebar__brand-sub">
              {course.code} · {course.name}
            </span>
          </div>

          <div>
            <p className="sidebar__section-label">Recorrido</p>
            <ul className="nav-list">
              {ROUTES.map((r) => (
                <li key={r.to}>
                  <NavLink to={r.to} end className="nav-link">
                    <Icon name={r.icon} />
                    <span>{r.label}</span>
                    {r.step && (
                      <span className="nav-link__step" aria-label={`paso ${r.step}`}>
                        {r.step}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar__footer">
            <span>Docente (demostración)</span>
            <button type="button" className="sidebar__reset" onClick={() => setConfirmReset(true)}>
              <Icon name="reset" />
              Restablecer demo
            </button>
          </div>
        </nav>

        <div className="main">
          <div className="demo-banner" role="note">
            <Icon name="info" size={16} />
            <span>
              <strong>Demostración del frontend.</strong> Los datos son de ejemplo y el procesamiento, la generación y la exportación
              están simulados. Tus decisiones se guardan solo en este navegador.
            </span>
          </div>
          <main id="contenido" className="content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="¿Restablecer la demostración?"
        confirmLabel="Restablecer"
        confirmVariant="danger"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      >
        <p>
          Se borrarán los documentos que registraste, las generaciones, las decisiones de revisión y las exportaciones guardadas en
          este navegador. Se volverán a cargar los datos de demostración iniciales.
        </p>
      </ConfirmDialog>
    </>
  );
}
