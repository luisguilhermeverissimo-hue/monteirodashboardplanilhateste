import { Router } from "express";
import { prisma } from "../../db/client";
import { requireAuth } from "../../middleware/auth";
import { requirePapel } from "../../middleware/rbac";
import { registrarEvento } from "../auditoria/auditLog";

export const descobertaRouter = Router();
descobertaRouter.use(requireAuth);

// Espec. §10.5 - Sugestões de descoberta (produzidas pelo motor de coleta via
// módulo Descoberta de Processos da Loy - endpoint pendente de confirmação,
// ver docs/especificacao-loy-integracao.md §13 item 5). O sistema nunca
// inclui um processo sozinho a partir de uma sugestão - Espec. §4.
descobertaRouter.get("/", async (_req, res) => {
  const sugestoes = await prisma.sugestaoDescoberta.findMany({
    where: { status: "PENDENTE" },
    orderBy: { detectadoEm: "desc" },
  });
  res.json(sugestoes);
});

descobertaRouter.post("/:id/confirmar", requirePapel(["SANEADOR", "ADMIN"]), async (req, res) => {
  const sugestao = await prisma.sugestaoDescoberta.findUnique({ where: { id: req.params.id } });
  if (!sugestao) return res.status(404).json({ erro: "Sugestão não encontrada" });

  const processo = await prisma.processo.create({
    data: {
      cnj: sugestao.cnj,
      autor: sugestao.autor,
      tribunal: sugestao.tribunal,
      naturezaJuridica: "A_DEFINIR",
      origem: "DESCOBERTA",
    },
  });

  await prisma.sugestaoDescoberta.update({
    where: { id: sugestao.id },
    data: { status: "CONFIRMADA", resolvidoPorId: req.usuario!.id, resolvidoEm: new Date() },
  });

  await registrarEvento({
    entidadeTipo: "SugestaoDescoberta",
    entidadeId: sugestao.id,
    acao: "SUGESTAO_CONFIRMADA",
    usuarioId: req.usuario!.id,
    detalhes: { processoId: processo.id },
  });

  res.status(201).json(processo);
});

descobertaRouter.post("/:id/descartar", requirePapel(["SANEADOR", "ADMIN"]), async (req, res) => {
  const sugestao = await prisma.sugestaoDescoberta.update({
    where: { id: req.params.id },
    data: { status: "DESCARTADA", resolvidoPorId: req.usuario!.id, resolvidoEm: new Date() },
  });

  await registrarEvento({
    entidadeTipo: "SugestaoDescoberta",
    entidadeId: sugestao.id,
    acao: "SUGESTAO_DESCARTADA",
    usuarioId: req.usuario!.id,
  });

  res.json(sugestao);
});
