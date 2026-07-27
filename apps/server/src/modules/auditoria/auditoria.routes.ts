import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requirePapel } from "../../middleware/rbac";
import { listarTrilha } from "./auditLog";

export const auditoriaRouter = Router();
auditoriaRouter.use(requireAuth);

// Espec. §10.9 - Linha do tempo de auditoria por processo ou publicação.
// Acesso restrito - Espec. §6 marca como "provável, a definir se todos ou só
// sócios"; decisão tomada aqui: restringir a ADMIN até essa definição ser
// fechada com o titular do projeto (ver docs/loy-integration-security-review.md §1.5).
auditoriaRouter.get(
  "/:entidadeTipo/:entidadeId",
  requirePapel(["ADMIN"]),
  async (req, res) => {
    const trilha = await listarTrilha(req.params.entidadeTipo, req.params.entidadeId);
    res.json(trilha);
  }
);
