import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate("/acervo");
    } catch {
      setErro("Credenciais inválidas");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 340, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ color: "var(--verde)", fontSize: "1.1rem" }}>Monteiro Processual</h1>
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        {erro && <span style={{ color: "var(--alerta)", fontSize: "0.85rem" }}>{erro}</span>}
        <button type="submit" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
