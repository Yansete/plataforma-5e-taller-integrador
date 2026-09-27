import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { InicioPage } from './pages/InicioPage';
import { CargaPage } from './pages/CargaPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { RevisionPage } from './pages/RevisionPage';
import { ExportacionPage } from './pages/ExportacionPage';
import { IndicadoresPage } from './pages/IndicadoresPage';
import { NoEncontradaPage } from './pages/NoEncontradaPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="carga" element={<CargaPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="revision" element={<RevisionPage />} />
          <Route path="exportacion" element={<ExportacionPage />} />
          <Route path="indicadores" element={<IndicadoresPage />} />
          <Route path="*" element={<NoEncontradaPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
