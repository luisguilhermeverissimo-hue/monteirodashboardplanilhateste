import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { requireAuth } from "../../middleware/auth";
import { requirePapel } from "../../middleware/rbac";
import { registrarEvento } from "../auditoria/auditLog";
import type { StatusPrazo } from "../../types/dominio";

export const prazosRouter = Router();
prazosRouter.use(requireAuth);

async function resolveProcessoIdDoPrazo(req: Request): Promise<string | undefined> {
  const prazo = await prisma.prazo.findUnique({
    where: { id: req.params.id },
    include: { publicacao: { select: { processoId: true } } },
  });
  return prazo?.publicacao.processoId;
}

// Espec. §10.6 - Tela de gestão de prazos (Em aberto / Cumpridos / Vencidos)
prazosRouter.get("/", async (req, res) => {
  const status = (req.query.status as StatusPrazo | undefined) ?? "ABERTO";
  const prazos = await prisma.prazo.findMany({
    where: { status },
    orderBy: { dataSugerida: "asc" },
    include: { publicacao: { include: { processo: true } } },
  });
  res.json(prazos);
});

const confirmarSchema = z.object({ dataConfirmada: z.string().datetime() });

// Espec. §9.3 - Confirmação humana obrigatória. O sistema nunca confirma
// prazo sozinho; este endpoint é o único que grava dataConfirmada/confirmadoPor,
// e é sempre registrado na auditoria como ato distinto da sugestão do motor.
prazosRouter.post(
  "/:id/confirmar",
  requirePapel(["SANEADOR", "ADMIN"], resolveProcessoIdDoPrazo),
  async (req, res) => {
    const parsed = confirmarSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: "dataConfirmada é obrigatória" });

    const prazo = await prisma.prazo.findUnique({ where: { id: req.params.id } });
    if (!prazo) return res.status(404).json({ erro: "Prazo não encontrado" });

    // Espec. §9.2: quando a regra exige o alerta de termo a quo, a confirmação
    // só é aceita se o cliente reconheceu o alerta explicitamente
    // (o corpo da requisição deve trazer confirmarAlerta=true nesse caso -
    // validação completa fica para a implementação da tela na Fase 2).
    const atualizado = await prisma.prazo.update({
      where: { id: req.params.id },
      data: {
        dataConfirmada: new Date(parsed.data.dataConfirmada),
        confirmadoPorId: req.usuario!.id,
        confirmadoEm: new Date(),
      },
    });

    await registrarEvento({
      entidadeTipo: "Prazo",
      entidadeId: prazo.id,
      acao: "PRAZO_CONFIRMADO",
      usuarioId: req.usuario!.id,
      detalhes: {
        dataSugerida: prazo.dataSugerida,
        dataConfirmada: parsed.data.dataConfirmada,
        alertaTermoAquo: prazo.alertaTermoAquo,
      },
    });

    res.json(atualizado);
  }
);

prazosRouter.post(
  "/:id/cumprido",
  requirePapel(["SANEADOR", "ADMIN"], resolveProcessoIdDoPrazo),
  async (req, res) => {
    const atualizado = await prisma.prazo.update({
      where: { id: req.params.id },
      data: { status: "CUMPRIDO" },
    });
    await registrarEvento({
      entidadeTipo: "Prazo",
      entidadeId: req.params.id,
      acao: "PRAZO_MARCADO_CUMPRIDO",
      usuarioId: req.usuario!.id,
    });
    res.json(atualizado);
  }
);
