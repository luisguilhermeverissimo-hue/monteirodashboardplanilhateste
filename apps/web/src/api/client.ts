// Cliente HTTP para o servidor-ponte (Camada 2). A interface NUNCA chama a
// API Loy diretamente - Espec. §3. Este é o único lugar que monta a base URL
// e anexa o token de sessão do usuário (JWT emitido pelo servidor-ponte,
// não o token da Loy - esse nunca chega ao navegador).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333/api";

function getToken(): string | null {
  return localStorage.getItem("monteiro:token");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ erro: res.statusText }));
    throw new ApiError(body.erro ?? "Erro na requisição", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};
