import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Processo } from "../types/dominio";

// Espec. §10.1 - Acervo completo
export function Acervo() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Processo[]>("/acervo")
      .then(setProcessos)
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Acervo completo</h2>
      {carregando ? (
        <p>Carregando...</p>
      ) : processos.length === 0 ? (
        <p style={{ color: "var(--ink-mute)" }}>Nenhum processo no acervo ainda.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>CNJ</th>
              <th>Autor</th>
              <th>Tribunal</th>
              <th>Natureza jurídica</th>
              <th>Último evento</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {processos.map((p) => (
              <tr key={p.id}>
                <td>{p.cnj}</td>
                <td>{p.autor}</td>
                <td>{p.tribunal}</td>
                <td>{p.naturezaJuridica}</td>
                <td>{p.ultimoEventoEm ? new Date(p.ultimoEventoEm).toLocaleDateString("pt-BR") : "—"}</td>
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
