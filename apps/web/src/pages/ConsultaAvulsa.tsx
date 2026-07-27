import { useState, type FormEvent } from "react";
import { api } from "../api/client";

interface ResultadoConsulta {
  capa: { classe: string; assunto: string; status: string };
  movimentos: { id: string; data: string; descricao: string }[];
  documentos: { file: string; nome: string }[];
}

// Espec. §10.3 - Consulta avulsa em tempo real, com promoção ao acervo
export function ConsultaAvulsa() {
  const [cnj, setCnj] = useState("");
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    setResultado(null);
    try {
      const dados = await api.post<ResultadoConsulta>("/acervo/consulta-avulsa", { cnj });
      setResultado(dados);
    } catch {
      setErro("Não foi possível consultar este CNJ na Loy.");
    } finally {
      setCarregando(false);
    }
  }

  async function promover() {
    if (!resultado) return;
    await api.post("/acervo/consulta-avulsa/promover", {
      cnj,
      autor: "",
      tribunal: "",
      naturezaJuridica: "",
    });
    alert("Processo promovido ao acervo. Complete os dados no Acervo completo.");
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Consulta avulsa</h2>
      <form onSubmit={consultar} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          placeholder="Número CNJ"
          value={cnj}
          onChange={(e) => setCnj(e.target.value)}
          style={{ flex: 1 }}
          required
        />
        <button type="submit" disabled={carregando}>
          {carregando ? "Consultando..." : "Consultar"}
        </button>
      </form>
      {erro && <p style={{ color: "var(--alerta)" }}>{erro}</p>}
      {resultado && (
        <div>
          <p>
            <strong>Classe:</strong> {resultado.capa.classe} — <strong>Status:</strong> {resultado.capa.status}
          </p>
          <h3 style={{ marginTop: 16 }}>Movimentos ({resultado.movimentos.length})</h3>
          <button className="secundario" style={{ marginTop: 12 }} onClick={promover}>
            Promover ao acervo
          </button>
        </div>
      )}
    </div>
  );
}
