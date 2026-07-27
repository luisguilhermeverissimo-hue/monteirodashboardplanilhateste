import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Prazo, StatusPrazo } from "../types/dominio";

const ABAS: { status: StatusPrazo; label: string }[] = [
  { status: "ABERTO", label: "Em aberto" },
  { status: "CUMPRIDO", label: "Cumpridos" },
  { status: "VENCIDO", label: "Vencidos sem cumprimento" },
];

// Espec. §10.6 - Tela de gestão de prazos
export function GestaoPrazos() {
  const [aba, setAba] = useState<StatusPrazo>("ABERTO");
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api
      .get<Prazo[]>(`/prazos?status=${aba}`)
      .then(setPrazos)
      .finally(() => setCarregando(false));
  }, [aba]);

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Gestão de prazos</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {ABAS.map((a) => (
          <button
            key={a.status}
            className={aba === a.status ? "" : "secundario"}
            onClick={() => setAba(a.status)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {carregando ? (
        <p>Carregando...</p>
      ) : prazos.length === 0 ? (
        <p style={{ color: "var(--ink-mute)" }}>Nenhum prazo nesta aba.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Prazo sugerido</th>
              <th>Prazo confirmado</th>
              <th>Regra aplicada</th>
              <th>Alerta</th>
            </tr>
          </thead>
          <tbody>
            {prazos.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.dataSugerida).toLocaleDateString("pt-BR")}</td>
                <td>{p.dataConfirmada ? new Date(p.dataConfirmada).toLocaleDateString("pt-BR") : "—"}</td>
                <td>{p.regraAplicadaCodigo}</td>
                <td>
                  {p.alertaTermoAquo && (
                    <span className="badge badge-alerta">Confirme a data da sessão de julgamento</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
