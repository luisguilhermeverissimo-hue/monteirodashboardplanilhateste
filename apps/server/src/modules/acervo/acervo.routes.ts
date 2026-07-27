import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { requireAuth } from "../../middleware/auth";
import { requirePapel } from "../../middleware/rbac";
import { registrarEvento } from "../auditoria/auditLog";
import { loyClient } from "../loy/loyClient";

export const acervoRouter = Router();
acervoRouter.use(requireAuth);

// Espec. §10.1 - Acervo completo
acervoRouter.get("/", async (_req, res) => {
  const processos = await prisma.processo.findMany({
    orderBy: { ultimoEventoEm: "desc" },
  });
  res.json(processos);
});

acervoRouter.get("/:id", async (req, res) => {
  const processo = await prisma.processo.findUnique({
    where: { id: req.params.id },
    include: { movimentos: { orderBy: { data: "desc" } } },
  });
  if (!processo) return res.status(404).json({ erro: "Processo não encontrado" });
  res.json(processo);
});

const cadastroManualSchema = z.object({
  cnj: z.string().min(1),
  autor: z.string().min(1),
  tribunal: z.string().min(1),
  naturezaJuridica: z.string().min(1),
});

// Espec. §10.4 - Formulário de cadastro manual
acervoRouter.post("/", requirePapel(["SANEADOR", "ADMIN"]), async (req, res) => {
  const parsed = cadastroManualSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.flatten().fieldErrors });
  }

  const processo = await prisma.processo.create({
    data: { ...parsed.data, origem: "MANUAL" },
  });

  await registrarEvento({
    entidadeTipo: "Processo",
    entidadeId: processo.id,
    acao: "CADASTRO_MANUAL",
    usuarioId: req.usuario!.id,
    detalhes: { cnj: processo.cnj },
  });

  res.status(201).json(processo);
});

const cnjSchema = z.object({ cnj: z.string().min(1) });

// Espec. §10.3 - Consulta avulsa (tempo real, não persiste até ser promovida)
acervoRouter.post("/consulta-avulsa", async (req, res) => {
  const parsed = cnjSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: "CNJ inválido" });
  }

  // TODO (Fase 4): validar dígito verificador do CNJ antes de chamar a Loy
  // (custo por chamada - ver docs/loy-integration-security-review.md §1.1).
  const { cnj } = parsed.data;
  await loyClient.captureProcess(cnj);
  const capa = await loyClient.getProcessoCapa(cnj);
  const movimentos = await loyClient.getMovimentos(cnj);
  const documentos = await loyClient.getDocumentos(cnj);

  res.json({ capa, movimentos, documentos });
});

// Promove uma consulta avulsa ao acervo permanente com um clique (Espec. §10.3)
acervoRouter.post("/consulta-avulsa/promover", requirePapel(["SANEADOR", "ADMIN"]), async (req, res) => {
  const parsed = cadastroManualSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.flatten().fieldErrors });
  }

  const processo = await prisma.processo.create({
    data: { ...parsed.data, origem: "CONSULTA_AVULSA" },
  });

  await registrarEvento({
    entidadeTipo: "Processo",
    entidadeId: processo.id,
    acao: "PROMOVIDO_DE_CONSULTA_AVULSA",
    usuarioId: req.usuario!.id,
  });

  res.status(201).json(processo);
});
