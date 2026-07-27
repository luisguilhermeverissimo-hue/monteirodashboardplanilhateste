import { Router } from "express";
import type { Request } from "express";
import { prisma } from "../../db/client";
import { requireAuth } from "../../middleware/auth";
import { requirePapel } from "../../middleware/rbac";
import { registrarEvento } from "../auditoria/auditLog";
import { loyClient } from "../loy/loyClient";

export const peticionamentoRouter = Router();
peticionamentoRouter.use(requireAuth);

async function resolveProcessoIdDaPublicacao(req: Request): Promise<string | undefined> {
  const publicacao = await prisma.publicacao.findUnique({
    where: { id: req.params.publicacaoId },
    select: { processoId: true },
  });
  return publicacao?.processoId;
}

// Espec. §10.8 - Painel do Peticionante: minutas aprovadas aguardando protocolo
peticionamentoRouter.get("/fila", requirePapel(["PETICIONANTE", "ADMIN"]), async (_req, res) => {
  const publicacoes = await prisma.publicacao.findMany({
    where: { status: "APROVADA" },
    include: { processo: true, minutas: { orderBy: { versao: "desc" }, take: 1 } },
  });
  res.json(publicacoes);
});

// Espec. §5 - Peticionamento: cria petição intermediária na Loy (rascunho).
// Exige, além do papel, que a publicação já esteja APROVADA - o protocolo
// nunca começa a partir de uma minuta que não passou pela aprovação do
// próprio Peticionante ou por engano de uma etapa anterior.
peticionamentoRouter.post(
  "/:publicacaoId/criar",
  requirePapel(["PETICIONANTE", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const publicacao = await prisma.publicacao.findUnique({
      where: { id: req.params.publicacaoId },
    });
    if (!publicacao) return res.status(404).json({ erro: "Publicação não encontrada" });
    if (publicacao.status !== "APROVADA") {
      return res.status(409).json({ erro: "Publicação precisa estar Aprovada para iniciar o protocolo" });
    }

    const loyIntermediate = await loyClient.createIntermediate(publicacao.processoId);

    const peticao = await prisma.peticaoIntermediaria.create({
      data: {
        publicacaoId: publicacao.id,
        loyIntermediateId: loyIntermediate.id,
        status: "RASCUNHO",
        criadoPorId: req.usuario!.id,
      },
    });

    await registrarEvento({
      entidadeTipo: "PeticaoIntermediaria",
      entidadeId: peticao.id,
      acao: "PETICAO_CRIADA",
      usuarioId: req.usuario!.id,
      detalhes: { loyIntermediateId: loyIntermediate.id },
    });

    res.status(201).json(peticao);
  }
);

// Espec. §5 - Peticionamento: consulta status/recibo
peticionamentoRouter.get("/:id/status", requirePapel(["PETICIONANTE", "ADMIN"]), async (req, res) => {
  const peticao = await prisma.peticaoIntermediaria.findUnique({ where: { id: req.params.id } });
  if (!peticao?.loyIntermediateId) return res.status(404).json({ erro: "Petição não encontrada" });

  const statusLoy = await loyClient.getIntermediateStatus(peticao.loyIntermediateId);
  res.json(statusLoy);
});

// Espec. §5 - Peticionamento: cancelamento (só permitido antes do protocolo)
peticionamentoRouter.post("/:id/cancelar", requirePapel(["PETICIONANTE", "ADMIN"]), async (req, res) => {
  const peticao = await prisma.peticaoIntermediaria.findUnique({ where: { id: req.params.id } });
  if (!peticao?.loyIntermediateId) return res.status(404).json({ erro: "Petição não encontrada" });
  if (peticao.status === "PROTOCOLADA") {
    return res.status(409).json({ erro: "Petição já protocolada não pode ser cancelada" });
  }

  await loyClient.cancelIntermediate(peticao.loyIntermediateId);
  const atualizada = await prisma.peticaoIntermediaria.update({
    where: { id: req.params.id },
    data: { status: "CANCELADA", canceladoEm: new Date() },
  });

  await registrarEvento({
    entidadeTipo: "PeticaoIntermediaria",
    entidadeId: peticao.id,
    acao: "PETICAO_CANCELADA",
    usuarioId: req.usuario!.id,
  });

  res.json(atualizada);
});
