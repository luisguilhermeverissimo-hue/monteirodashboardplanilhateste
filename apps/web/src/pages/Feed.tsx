import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Publicacao } from "../types/dominio";

// Espec. §10.2 - Feed de novidades (ponto de entrada da triagem do Saneador)
export function Feed() {
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Publicacao[]>("/publicacoes?status=NOVA")
      .then(setPublicacoes)
      .finally(() => setCarregando(false));
  }, []);

  async function triar(id: string) {
    await api.post(`/publicacoes/${id}/triagem`);
    setPublicacoes((atual) => atual.filter((p) => p.id !== id));
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Feed de novidades</h2>
      <p style={{ color: "var(--ink-mute)", marginBottom: 16 }}>{publicacoes.length} não triada(s)</p>
      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Processo</th>
              <th>Recebido em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {publicacoes.map((p) => (
              <tr key={p.id}>
                <td>{p.processo?.cnj ?? p.processoId}</td>
                <td>{new Date(p.criadoEm).toLocaleString("pt-BR")}</td>
                <td>
                  <button onClick={() => triar(p.id)}>Confirmar triagem</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
