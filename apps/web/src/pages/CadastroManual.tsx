import { useState, type FormEvent } from "react";
import { api } from "../api/client";

// Espec. §10.4 - Formulário de cadastro manual
export function CadastroManual() {
  const [form, setForm] = useState({ cnj: "", autor: "", tribunal: "", naturezaJuridica: "" });
  const [status, setStatus] = useState<"idle" | "enviando" | "sucesso" | "erro">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("enviando");
    try {
      await api.post("/acervo", form);
      setStatus("sucesso");
      setForm({ cnj: "", autor: "", tribunal: "", naturezaJuridica: "" });
    } catch {
      setStatus("erro");
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ marginBottom: 16 }}>Cadastro manual de processo</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          placeholder="Número CNJ"
          value={form.cnj}
          onChange={(e) => setForm({ ...form, cnj: e.target.value })}
          required
        />
        <input
          placeholder="Autor"
          value={form.autor}
          onChange={(e) => setForm({ ...form, autor: e.target.value })}
          required
        />
        <input
          placeholder="Tribunal"
          value={form.tribunal}
          onChange={(e) => setForm({ ...form, tribunal: e.target.value })}
          required
        />
        <input
          placeholder="Natureza jurídica"
          value={form.naturezaJuridica}
          onChange={(e) => setForm({ ...form, naturezaJuridica: e.target.value })}
          required
        />
        <button type="submit" disabled={status === "enviando"}>
          Adicionar ao acervo
        </button>
        {status === "sucesso" && <span style={{ color: "var(--verde)" }}>Processo cadastrado.</span>}
        {status === "erro" && <span style={{ color: "var(--alerta)" }}>Erro ao cadastrar.</span>}
      </form>
    </div>
  );
}
