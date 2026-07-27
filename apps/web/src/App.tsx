import { Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./layout/Layout";
import { Acervo } from "./pages/Acervo";
import { AuditoriaTimeline } from "./pages/AuditoriaTimeline";
import { CadastroManual } from "./pages/CadastroManual";
import { ConsultaAvulsa } from "./pages/ConsultaAvulsa";
import { Feed } from "./pages/Feed";
import { FilaRedator } from "./pages/FilaRedator";
import { GestaoPrazos } from "./pages/GestaoPrazos";
import { Login } from "./pages/Login";
import { PainelPeticionante } from "./pages/PainelPeticionante";
import { SugestoesDescoberta } from "./pages/SugestoesDescoberta";

function RotasProtegidas() {
  const { usuario, carregando } = useAuth();

  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/acervo" element={<Acervo />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/consulta-avulsa" element={<ConsultaAvulsa />} />
        <Route path="/cadastro-manual" element={<CadastroManual />} />
        <Route path="/descoberta" element={<SugestoesDescoberta />} />
        <Route path="/prazos" element={<GestaoPrazos />} />
        <Route path="/fila-redator" element={<FilaRedator />} />
        <Route path="/painel-peticionante" element={<PainelPeticionante />} />
        <Route path="/auditoria/:entidadeTipo/:entidadeId" element={<AuditoriaTimeline />} />
        <Route path="*" element={<Navigate to="/acervo" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<RotasProtegidas />} />
      </Routes>
    </AuthProvider>
  );
}
