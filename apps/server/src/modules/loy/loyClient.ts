import { env } from "../../config/env";

// Cliente HTTP da API Loy - Espec. §5.
//
// Este módulo é o ÚNICO ponto do sistema autorizado a chamar a API Loy
// (Espec. §3: "o servidor-ponte guarda o token, executa as chamadas reais").
// Nem o motor de coleta nem as rotas do servidor-ponte devem montar
// requisições à Loy fora daqui - centralizar facilita auditar, aplicar
// rate limiting e trocar o token sem procurar chamadas espalhadas.
//
// Os formatos de payload abaixo são melhor esforço a partir da tabela de
// endpoints da especificação (Espec. §5) e ainda dependem de confirmação
// com o suporte da Loy nos pontos marcados como pendência (ver
// docs/especificacao-loy-integracao.md §13, itens 1 e 2). Ajustar os tipos
// `LoyXxx` assim que a documentação oficial/sandbox estiver disponível.

class LoyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "LoyApiError";
  }
}

async function loyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${env.LOY_API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.LOY_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    throw new LoyApiError(`Loy API respondeu ${res.status} em ${path}`, res.status, body);
  }

  return (await res.json()) as T;
}

export interface LoyProcessoCapa {
  cnj: string;
  partes: unknown;
  classe: string;
  assunto: string;
  magistrado: string | null;
  valor: number | null;
  status: string;
}

export interface LoyMovimento {
  id: string;
  data: string;
  descricao: string;
  tipo?: string;
  workload?: string;
}

export interface LoyDocumento {
  file: string;
  nome: string;
  secretLevel: number;
  workload?: string;
}

export interface LoyIntermediateStatus {
  id: string;
  status: string;
  reciboUrl?: string;
}

export const loyClient = {
  // Trust / Integração - obtém sessão autenticada por tribunal (Espec. §5)
  async accessExternal(tribunal: string): Promise<{ sessionToken: string }> {
    return loyFetch("access-external", {
      method: "POST",
      body: JSON.stringify({ tribunal }),
    });
  },

  // Consulta - Importação: registra CNJ na base Loy (assíncrono)
  async captureProcess(cnj: string): Promise<{ status: string }> {
    return loyFetch("process/capture", {
      method: "POST",
      body: JSON.stringify({ cnj }),
    });
  },

  // Consulta - Capa
  async getProcessoCapa(cnj: string): Promise<LoyProcessoCapa> {
    return loyFetch(`process/${encodeURIComponent(cnj)}`);
  },

  // Consulta - Movimentos (fonte primária de detecção de intimação/publicação nova)
  async getMovimentos(processoId: string): Promise<LoyMovimento[]> {
    return loyFetch(`movements/${encodeURIComponent(processoId)}`);
  },

  // Consulta - Documentos
  async getDocumentos(processoId: string): Promise<LoyDocumento[]> {
    return loyFetch(`documents/${encodeURIComponent(processoId)}`);
  },

  // Consulta - Download (retorna o binário do PDF)
  async downloadDocumentoFile(file: string): Promise<ArrayBuffer> {
    const url = `${env.LOY_API_BASE_URL.replace(/\/$/, "")}/documents/file/${encodeURIComponent(file)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.LOY_API_TOKEN}` },
    });
    if (!res.ok) {
      throw new LoyApiError(`Loy API respondeu ${res.status} ao baixar documento`, res.status, undefined);
    }
    return res.arrayBuffer();
  },

  // Peticionamento - Criação de petição intermediária (rascunho)
  async createIntermediate(processoId: string): Promise<{ id: string }> {
    return loyFetch("intermediates", {
      method: "POST",
      body: JSON.stringify({ processoId }),
    });
  },

  // Peticionamento - Upload (uma chamada por arquivo)
  async uploadDocumento(intermediateId: string, arquivo: Buffer, nomeArquivo: string): Promise<{ file: string }> {
    const form = new FormData();
    form.append("intermediateId", intermediateId);
    form.append("file", new Blob([arquivo]), nomeArquivo);

    const url = `${env.LOY_API_BASE_URL.replace(/\/$/, "")}/documents/upload`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.LOY_API_TOKEN}` },
      body: form,
    });
    if (!res.ok) {
      throw new LoyApiError(`Loy API respondeu ${res.status} no upload`, res.status, undefined);
    }
    return (await res.json()) as { file: string };
  },

  // Peticionamento - Recibo / status
  async getIntermediateStatus(intermediateId: string): Promise<LoyIntermediateStatus> {
    return loyFetch(`intermediates/${encodeURIComponent(intermediateId)}`);
  },

  // Peticionamento - Cancelamento (petição ainda não protocolada)
  async cancelIntermediate(intermediateId: string): Promise<{ status: string }> {
    return loyFetch(`intermediates/${encodeURIComponent(intermediateId)}`, {
      method: "DELETE",
    });
  },
};

export { LoyApiError };
