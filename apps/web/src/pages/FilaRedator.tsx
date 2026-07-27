import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Publicacao } from "../types/dominio";

// Espec. §10.7 - Fila do Redator (apenas publicações atribuídas ao redator logado)
export function FilaRedator() {
  const [fila, setFila] = useState<Publicacao[]>([]);

  useEffect(() => {
    api.get<Publicacao[]>("/publicacoes/minha-fila").then(setFila);
  }, []);

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Fila do Redator</h2>
      {fila.length === 0 ? (
        <p style={{ color: "var(--ink-mute)" }}>Nenhuma publicação atribuída no momento.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Processo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {fila.map((p) => (
              <tr key={p.id}>
                <td>{p.processo?.cnj ?? p.processoId}</td>
                <td>
                  <span className="badge">{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
