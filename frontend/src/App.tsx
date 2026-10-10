import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider, useSession } from './state/datos';
import { CursoFormPage } from './pages/CursoFormPage';
import { CursoPage } from './pages/CursoPage';
import { LoginPage } from './pages/LoginPage';
import { MisCursosPage } from './pages/MisCursosPage';
import { NoEncontradaPage } from './pages/NoEncontradaPage';
import { RegistroPage } from './pages/RegistroPage';
import { UnidadPage } from './pages/unidad/UnidadPage';

/** Sin sesión, las pantallas internas llevan a «Inicio de sesión» y luego regresan a donde estaba el docente. */
function SessionRequired() {
  const session = useSession();
  const location = useLocation();
  return session ? <Outlet /> : <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
}

export function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <Routes>
          <Route path="entrar" element={<LoginPage />} />
          <Route path="crear-cuenta" element={<RegistroPage />} />
          <Route element={<SessionRequired />}>
            <Route element={<Layout />}>
              <Route index element={<MisCursosPage />} />
              <Route path="cursos/nuevo" element={<CursoFormPage />} />
              <Route path="cursos/:courseId" element={<CursoPage />} />
              <Route path="cursos/:courseId/editar" element={<CursoFormPage />} />
              <Route path="cursos/:courseId/unidades/:unitId" element={<UnidadPage />} />
              <Route path="cursos/:courseId/unidades/:unitId/:tab" element={<UnidadPage />} />
              <Route path="*" element={<NoEncontradaPage />} />
            </Route>
          </Route>
        </Routes>
      </DataProvider>
    </BrowserRouter>
  );
}
