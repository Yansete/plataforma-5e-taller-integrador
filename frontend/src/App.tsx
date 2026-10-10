import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { InicioPage } from './pages/InicioPage';
import { CargaPage } from './pages/CargaPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { RevisionPage } from './pages/RevisionPage';
import { ExportacionPage } from './pages/ExportacionPage';
import { IndicadoresPage } from './pages/IndicadoresPage';
import { NoEncontradaPage } from './pages/NoEncontradaPage';

import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { CursosPage } from './pages/CursosPage';
import { useDemoSession } from './services';
function DemoSessionRequired() {
  return useDemoSession() ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<DemoSessionRequired />}>
          <Route element={<Layout />}>
            <Route path="cursos" element={<CursosPage />} />
            <Route index element={<InicioPage />} />
            <Route path="carga" element={<CargaPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="configuracion" element={<ConfiguracionPage />} />
            <Route path="revision" element={<RevisionPage />} />
            <Route path="exportacion" element={<ExportacionPage />} />
            <Route path="indicadores" element={<IndicadoresPage />} />
            <Route path="*" element={<NoEncontradaPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
