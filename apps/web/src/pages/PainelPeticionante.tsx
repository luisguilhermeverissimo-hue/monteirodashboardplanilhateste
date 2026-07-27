import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Publicacao } from "../types/dominio";

// Espec. §10.8 - Painel do Peticionante
export function PainelPeticionante() {
  const [fila, setFila] = useState<Publicacao[]>([]);

  useEffect(() => {
    api.get<Publicacao[]>("/peticionamento/fila").then(setFila);
  }, []);

  async function aprovar(id: string) {
    await api.post(`/publicacoes/${id}/aprovar`);
    setFila((atual) => atual.filter((p) => p.id !== id));
  }

  async function devolver(id: string) {
    const observacao = prompt("Motivo da devolução:");
    if (!observacao) return;
    await api.post(`/publicacoes/${id}/devolver`, { observacao });
    setFila((atual) => atual.filter((p) => p.id !== id));
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Painel do Peticionante</h2>
      {fila.length === 0 ? (
        <p style={{ color: "var(--ink-mute)" }}>Nenhuma minuta pronta para protocolo.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Processo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fila.map((p) => (
              <tr key={p.id}>
                <td>{p.processo?.cnj ?? p.processoId}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => aprovar(p.id)}>Aprovar</button>
                  <button className="secundario" onClick={() => devolver(p.id)}>
                    Devolver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
