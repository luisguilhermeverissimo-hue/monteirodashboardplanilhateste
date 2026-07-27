import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import type { Papel } from "../types/dominio";

interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
}

interface PapelAtribuido {
  papel: Papel;
  processoId: string | null;
}

interface AuthState {
  usuario: UsuarioLogado | null;
  papeis: PapelAtribuido[];
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  // Espelha, no cliente, a checagem que o servidor já faz de verdade
  // (RBAC aplicado por rota - ver docs/loy-integration-security-review.md §1.1).
  // Serve só para não mostrar controles que o usuário não pode usar; a
  // interface NUNCA deve tratar isso como o controle de acesso real.
  temPapel: (papel: Papel, processoId?: string) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [papeis, setPapeis] = useState<PapelAtribuido[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarSessao = useCallback(async () => {
    const token = localStorage.getItem("monteiro:token");
    if (!token) {
      setCarregando(false);
      return;
    }
    try {
      const dados = await api.get<{ usuario: UsuarioLogado; papeis: PapelAtribuido[] }>("/auth/me");
      setUsuario(dados.usuario);
      setPapeis(dados.papeis);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("monteiro:token");
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarSessao();
  }, [carregarSessao]);

  const login = useCallback(async (email: string, senha: string) => {
    const resultado = await api.post<{ token: string; usuario: UsuarioLogado }>("/auth/login", {
      email,
      senha,
    });
    localStorage.setItem("monteiro:token", resultado.token);
    setUsuario(resultado.usuario);
    const dados = await api.get<{ papeis: PapelAtribuido[] }>("/auth/me");
    setPapeis(dados.papeis);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("monteiro:token");
    setUsuario(null);
    setPapeis([]);
  }, []);

  const temPapel = useCallback(
    (papel: Papel, processoId?: string) =>
      papeis.some((p) => p.papel === papel && (p.processoId === null || p.processoId === processoId)),
    [papeis]
  );

  return (
    <AuthContext.Provider value={{ usuario, papeis, carregando, login, logout, temPapel }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
