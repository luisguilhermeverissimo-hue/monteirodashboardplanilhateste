import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { requireAuth } from "../../middleware/auth";
import { requirePapel } from "../../middleware/rbac";
import { registrarEvento } from "../auditoria/auditLog";
import { TRANSICOES_PUBLICACAO, type StatusPublicacao } from "../../types/dominio";

export const publicacoesRouter = Router();
publicacoesRouter.use(requireAuth);

async function resolveProcessoIdDaPublicacao(req: Request): Promise<string | undefined> {
  const publicacao = await prisma.publicacao.findUnique({
    where: { id: req.params.id },
    select: { processoId: true },
  });
  return publicacao?.processoId;
}

// Espec. §10.2 - Feed de novidades (publicações mais recentes no topo)
publicacoesRouter.get("/", async (req, res) => {
  const status = req.query.status as StatusPublicacao | undefined;
  const publicacoes = await prisma.publicacao.findMany({
    where: status ? { status } : undefined,
    orderBy: { criadoEm: "desc" },
    include: { processo: true, movimento: true, prazo: true },
  });
  res.json(publicacoes);
});

// Espec. §10.7 - Fila do Redator (apenas publicações atribuídas ao redator logado)
publicacoesRouter.get("/minha-fila", async (req, res) => {
  const publicacoes = await prisma.publicacao.findMany({
    where: { redatorId: req.usuario!.id, status: "AGUARDANDO_REDACAO" },
    orderBy: { prazo: { dataConfirmada: "asc" } },
    include: { processo: true, prazo: true },
  });
  res.json(publicacoes);
});

type ResultadoTransicao =
  | { ok: true; erro?: undefined; mensagem?: undefined; publicacao: Awaited<ReturnType<typeof prisma.publicacao.update>> }
  | { ok: false; erro: number; mensagem: string; publicacao?: undefined };

async function transicionar(
  publicacaoId: string,
  novoStatus: StatusPublicacao,
  usuarioId: string,
  acao: string,
  detalhes?: Record<string, unknown>
): Promise<ResultadoTransicao> {
  const publicacao = await prisma.publicacao.findUnique({ where: { id: publicacaoId } });
  if (!publicacao) {
    return { ok: false, erro: 404, mensagem: "Publicação não encontrada" };
  }

  const permitido = TRANSICOES_PUBLICACAO[publicacao.status as StatusPublicacao]?.includes(novoStatus);
  if (!permitido) {
    return {
      ok: false,
      erro: 409,
      mensagem: `Transição de ${publicacao.status} para ${novoStatus} não é permitida`,
    };
  }

  const atualizada = await prisma.publicacao.update({
    where: { id: publicacaoId },
    data: { status: novoStatus },
  });

  await registrarEvento({
    entidadeTipo: "Publicacao",
    entidadeId: publicacaoId,
    acao,
    usuarioId,
    detalhes: { de: publicacao.status, para: novoStatus, ...detalhes },
  });

  return { ok: true, publicacao: atualizada };
}

// Saneador confirma a triagem (o prazo em si é confirmado via modulo prazos)
publicacoesRouter.post(
  "/:id/triagem",
  requirePapel(["SANEADOR", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const resultado = await transicionar(req.params.id, "TRIADA", req.usuario!.id, "TRIAGEM_CONFIRMADA");
    if (!resultado.ok) return res.status(resultado.erro).json({ erro: resultado.mensagem });
    res.json(resultado.publicacao);
  }
);

const atribuirSchema = z.object({ redatorId: z.string().min(1) });

// Saneador atribui a publicação a um Redator
publicacoesRouter.post(
  "/:id/atribuir",
  requirePapel(["SANEADOR", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const parsed = atribuirSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: "redatorId é obrigatório" });

    const resultado = await transicionar(
      req.params.id,
      "AGUARDANDO_REDACAO",
      req.usuario!.id,
      "ATRIBUIDA_PARA_REDACAO",
      { redatorId: parsed.data.redatorId }
    );
    if (!resultado.ok) return res.status(resultado.erro).json({ erro: resultado.mensagem });

    await prisma.publicacao.update({
      where: { id: req.params.id },
      data: { redatorId: parsed.data.redatorId },
    });

    res.json(resultado.publicacao);
  }
);

const minutaSchema = z.object({ arquivoPath: z.string().min(1), observacao: z.string().optional() });

// Redator anexa minuta e envia para protocolo (Espec. §7)
publicacoesRouter.post(
  "/:id/minutas",
  requirePapel(["REDATOR", "PETICIONANTE", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const parsed = minutaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: "arquivoPath é obrigatório" });

    const ultimaVersao = await prisma.minuta.findFirst({
      where: { publicacaoId: req.params.id },
      orderBy: { versao: "desc" },
    });

    const minuta = await prisma.minuta.create({
      data: {
        publicacaoId: req.params.id,
        versao: (ultimaVersao?.versao ?? 0) + 1,
        autorId: req.usuario!.id,
        arquivoPath: parsed.data.arquivoPath,
        observacao: parsed.data.observacao,
      },
    });

    const resultado = await transicionar(
      req.params.id,
      "PRONTA_PROTOCOLO",
      req.usuario!.id,
      "MINUTA_ANEXADA",
      { minutaId: minuta.id, versao: minuta.versao }
    );
    if (!resultado.ok) return res.status(resultado.erro).json({ erro: resultado.mensagem });

    res.status(201).json({ minuta, publicacao: resultado.publicacao });
  }
);

// Peticionante aprova a minuta (inicia o fluxo de peticionamento na Loy - módulo peticionamento)
publicacoesRouter.post(
  "/:id/aprovar",
  requirePapel(["PETICIONANTE", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const resultado = await transicionar(req.params.id, "APROVADA", req.usuario!.id, "MINUTA_APROVADA");
    if (!resultado.ok) return res.status(resultado.erro).json({ erro: resultado.mensagem });
    res.json(resultado.publicacao);
  }
);

const devolverSchema = z.object({ observacao: z.string().min(1) });

// Peticionante devolve a minuta para ajuste, com observação obrigatória
publicacoesRouter.post(
  "/:id/devolver",
  requirePapel(["PETICIONANTE", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const parsed = devolverSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: "observacao é obrigatória ao devolver" });

    const resultado = await transicionar(
      req.params.id,
      "DEVOLVIDA",
      req.usuario!.id,
      "MINUTA_DEVOLVIDA",
      { observacao: parsed.data.observacao }
    );
    if (!resultado.ok) return res.status(resultado.erro).json({ erro: resultado.mensagem });
    res.json(resultado.publicacao);
  }
);

// Saneador marca publicação que não exige resposta como "Tratada" diretamente
publicacoesRouter.post(
  "/:id/tratada",
  requirePapel(["SANEADOR", "ADMIN"], resolveProcessoIdDaPublicacao),
  async (req, res) => {
    const resultado = await transicionar(req.params.id, "TRATADA", req.usuario!.id, "MARCADA_TRATADA");
    if (!resultado.ok) return res.status(resultado.erro).json({ erro: resultado.mensagem });
    res.json(resultado.publicacao);
  }
);
