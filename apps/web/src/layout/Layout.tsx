import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";

// Navegação principal. Os itens visíveis dependem do papel só como
// conveniência de UI - a permissão de fato é sempre checada no servidor
// (ver docs/loy-integration-security-review.md §1.1).
const ITENS_NAV = [
  { path: "/acervo", label: "Acervo completo", papel: null },
  { path: "/feed", label: "Feed de novidades", papel: null },
  { path: "/consulta-avulsa", label: "Consulta avulsa", papel: null },
  { path: "/cadastro-manual", label: "Cadastro manual", papel: "SANEADOR" as const },
  { path: "/descoberta", label: "Sugestões de descoberta", papel: "SANEADOR" as const },
  { path: "/prazos", label: "Gestão de prazos", papel: null },
  { path: "/fila-redator", label: "Fila do Redator", papel: "REDATOR" as const },
  { path: "/painel-peticionante", label: "Painel do Peticionante", papel: "PETICIONANTE" as const },
];

export function Layout() {
  const { usuario, logout, temPapel } = useAuth();

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <h1>Monteiro Processual</h1>
        {ITENS_NAV.filter((item) => !item.papel || temPapel(item.papel)).map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => (isActive ? "active" : "")}>
            {item.label}
          </NavLink>
        ))}
        <div style={{ marginTop: "auto", paddingTop: 24, fontSize: "0.8rem", color: "var(--ink-mute)" }}>
          {usuario?.nome}
          <br />
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          >
            Sair
          </a>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
