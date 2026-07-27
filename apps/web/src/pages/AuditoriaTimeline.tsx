import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "../api/client";

interface EventoAuditoria {
  id: string;
  acao: string;
  criadoEm: string;
  usuario: { nome: string } | null;
  detalhes: string | null;
}

// Espec. §10.9 - Linha do tempo de auditoria por processo ou publicação.
// Rota: /auditoria/:entidadeTipo/:entidadeId
export function AuditoriaTimeline() {
  const { entidadeTipo, entidadeId } = useParams();
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);

  useEffect(() => {
    if (!entidadeTipo || !entidadeId) return;
    api.get<EventoAuditoria[]>(`/auditoria/${entidadeTipo}/${entidadeId}`).then(setEventos);
  }, [entidadeTipo, entidadeId]);

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>
        Trilha de auditoria — {entidadeTipo} {entidadeId}
      </h2>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
        {eventos.map((e) => (
          <li key={e.id} style={{ borderLeft: "2px solid var(--verde)", paddingLeft: 12 }}>
            <strong>{e.acao}</strong>
            <div style={{ fontSize: "0.85rem", color: "var(--ink-mute)" }}>
              {e.usuario?.nome ?? "sistema"} — {new Date(e.criadoEm).toLocaleString("pt-BR")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
