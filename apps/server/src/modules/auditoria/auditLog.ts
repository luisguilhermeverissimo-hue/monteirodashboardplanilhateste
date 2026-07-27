import { createHash } from "node:crypto";
import { prisma } from "../../db/client";

// Trilha de auditoria imutável - Espec. §8.
//
// Este é o ÚNICO ponto do código autorizado a escrever em AuditoriaEvento.
// Nenhum outro módulo deve chamar prisma.auditoriaEvento.update/delete -
// o model é append-only por convenção aqui e deve, antes de produção, também
// ser reforçado por permissão de banco (a conta de serviço da aplicação não
// deveria ter GRANT de UPDATE/DELETE nesta tabela). Ver
// docs/loy-integration-security-review.md §1.5.
//
// Cada evento inclui o hash do evento anterior (hash-chain), tornando
// detectável qualquer adulteração retroativa mesmo por quem tiver acesso
// direto ao banco.

export interface RegistrarEventoInput {
  entidadeTipo: string;
  entidadeId: string;
  acao: string;
  usuarioId: string | null;
  detalhes?: Record<string, unknown>;
}

function calcularHash(params: {
  entidadeTipo: string;
  entidadeId: string;
  acao: string;
  usuarioId: string | null;
  detalhes: string;
  criadoEm: string;
  hashAnterior: string | null;
}): string {
  const payload = JSON.stringify(params);
  return createHash("sha256").update(payload).digest("hex");
}

export async function registrarEvento(input: RegistrarEventoInput) {
  return prisma.$transaction(async (tx) => {
    const ultimo = await tx.auditoriaEvento.findFirst({
      orderBy: { criadoEm: "desc" },
      select: { hash: true },
    });

    const criadoEm = new Date();
    const detalhesJson = JSON.stringify(input.detalhes ?? {});
    const hash = calcularHash({
      entidadeTipo: input.entidadeTipo,
      entidadeId: input.entidadeId,
      acao: input.acao,
      usuarioId: input.usuarioId,
      detalhes: detalhesJson,
      criadoEm: criadoEm.toISOString(),
      hashAnterior: ultimo?.hash ?? null,
    });

    return tx.auditoriaEvento.create({
      data: {
        entidadeTipo: input.entidadeTipo,
        entidadeId: input.entidadeId,
        acao: input.acao,
        usuarioId: input.usuarioId,
        detalhes: detalhesJson,
        criadoEm,
        hashAnterior: ultimo?.hash ?? null,
        hash,
      },
    });
  });
}

export async function listarTrilha(entidadeTipo: string, entidadeId: string) {
  return prisma.auditoriaEvento.findMany({
    where: { entidadeTipo, entidadeId },
    orderBy: { criadoEm: "asc" },
    include: { usuario: { select: { id: true, nome: true } } },
  });
}

// Verifica a integridade da hash-chain de um conjunto de eventos (uso em
// auditoria/testes - não faz parte do caminho crítico de escrita).
export function verificarIntegridade(
  eventos: { hash: string; hashAnterior: string | null }[]
): boolean {
  for (let i = 1; i < eventos.length; i++) {
    if (eventos[i]?.hashAnterior !== eventos[i - 1]?.hash) {
      return false;
    }
  }
  return true;
}
