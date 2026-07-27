// Mantido em espelho manual de apps/server/src/types/dominio.ts.
// TODO: extrair para um pacote compartilhado (packages/shared) quando o
// modelo de domínio estabilizar - ver README raiz. Até lá, qualquer mudança
// nos valores válidos de papel/status precisa ser replicada nos dois lados.

export const PAPEIS = ["SANEADOR", "REDATOR", "PETICIONANTE", "ADMIN"] as const;
export type Papel = (typeof PAPEIS)[number];

export const STATUS_PUBLICACAO = [
  "NOVA",
  "TRIADA",
  "AGUARDANDO_REDACAO",
  "PRONTA_PROTOCOLO",
  "APROVADA",
  "DEVOLVIDA",
  "PROTOCOLADA",
  "TRATADA",
] as const;
export type StatusPublicacao = (typeof STATUS_PUBLICACAO)[number];

export const STATUS_PRAZO = ["ABERTO", "CUMPRIDO", "VENCIDO"] as const;
export type StatusPrazo = (typeof STATUS_PRAZO)[number];

export interface Processo {
  id: string;
  cnj: string;
  autor: string;
  tribunal: string;
  naturezaJuridica: string;
  status: string;
  sigiloso: boolean;
  ultimoEventoEm: string | null;
}

export interface Publicacao {
  id: string;
  processoId: string;
  status: StatusPublicacao;
  criadoEm: string;
  processo?: Processo;
}

export interface Prazo {
  id: string;
  publicacaoId: string;
  regraAplicadaCodigo: string;
  dataSugerida: string;
  dataConfirmada: string | null;
  alertaTermoAquo: boolean;
  status: StatusPrazo;
}
