// Conjuntos de valores válidos para os campos "String" do schema Prisma
// (SQLite não suporta enum nativo - ver comentário no topo do schema.prisma).
// Centralizar aqui evita que rotas e o motor de prazos divirjam sobre os valores aceitos.

export const PAPEIS = ["SANEADOR", "REDATOR", "PETICIONANTE", "ADMIN"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ORIGENS_PROCESSO = ["PLANILHA", "DESCOBERTA", "MANUAL", "CONSULTA_AVULSA"] as const;
export type OrigemProcesso = (typeof ORIGENS_PROCESSO)[number];

// Máquina de estados da publicação - Espec. §7
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

// Transições permitidas por papel - a checagem de papel acontece no
// middleware RBAC (src/middleware/rbac.ts); este mapa documenta e valida
// a transição de estado em si, independente de quem a solicita.
export const TRANSICOES_PUBLICACAO: Record<StatusPublicacao, StatusPublicacao[]> = {
  NOVA: ["TRIADA"],
  TRIADA: ["AGUARDANDO_REDACAO", "TRATADA"],
  AGUARDANDO_REDACAO: ["PRONTA_PROTOCOLO"],
  PRONTA_PROTOCOLO: ["APROVADA", "DEVOLVIDA"],
  DEVOLVIDA: ["AGUARDANDO_REDACAO"],
  APROVADA: ["PROTOCOLADA"],
  PROTOCOLADA: [],
  TRATADA: [],
};

export const TIPOS_CONTAGEM_PRAZO = ["CORRIDO", "UTIL"] as const;
export type TipoContagemPrazo = (typeof TIPOS_CONTAGEM_PRAZO)[number];

export const STATUS_PRAZO = ["ABERTO", "CUMPRIDO", "VENCIDO"] as const;
export type StatusPrazo = (typeof STATUS_PRAZO)[number];

export const STATUS_PETICAO = ["RASCUNHO", "ENVIADA", "PROTOCOLADA", "CANCELADA"] as const;
export type StatusPeticao = (typeof STATUS_PETICAO)[number];

export const STATUS_SUGESTAO_DESCOBERTA = ["PENDENTE", "CONFIRMADA", "DESCARTADA"] as const;
export type StatusSugestaoDescoberta = (typeof STATUS_SUGESTAO_DESCOBERTA)[number];

export const STATUS_COLLECTOR_RUN = ["EM_ANDAMENTO", "SUCESSO", "ERRO"] as const;
export type StatusCollectorRun = (typeof STATUS_COLLECTOR_RUN)[number];
