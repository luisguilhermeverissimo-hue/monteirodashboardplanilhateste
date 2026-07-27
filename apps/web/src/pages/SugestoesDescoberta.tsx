import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Sugestao {
  id: string;
  cnj: string;
  autor: string;
  tribunal: string;
  detectadoEm: string;
}

// Espec. §10.5 - Sugestões de descoberta (nunca incluídas sozinhas - Espec. §4)
export function SugestoesDescoberta() {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);

  useEffect(() => {
    api.get<Sugestao[]>("/descoberta").then(setSugestoes);
  }, []);

  async function confirmar(id: string) {
    await api.post(`/descoberta/${id}/confirmar`);
    setSugestoes((atual) => atual.filter((s) => s.id !== id));
  }

  async function descartar(id: string) {
    await api.post(`/descoberta/${id}/descartar`);
    setSugestoes((atual) => atual.filter((s) => s.id !== id));
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Sugestões de descoberta</h2>
      {sugestoes.length === 0 ? (
        <p style={{ color: "var(--ink-mute)" }}>Nenhuma sugestão pendente.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>CNJ</th>
              <th>Autor</th>
              <th>Tribunal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sugestoes.map((s) => (
              <tr key={s.id}>
                <td>{s.cnj}</td>
                <td>{s.autor}</td>
                <td>{s.tribunal}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => confirmar(s.id)}>Incluir no acervo</button>
                  <button className="secundario" onClick={() => descartar(s.id)}>
                    Descartar
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
