import { Router } from "express";
import { acervoRouter } from "../modules/acervo/acervo.routes";
import { auditoriaRouter } from "../modules/auditoria/auditoria.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { descobertaRouter } from "../modules/descoberta/descoberta.routes";
import { peticionamentoRouter } from "../modules/peticionamento/peticionamento.routes";
import { prazosRouter } from "../modules/prazos/prazos.routes";
import { publicacoesRouter } from "../modules/publicacoes/publicacoes.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/acervo", acervoRouter);
apiRouter.use("/publicacoes", publicacoesRouter);
apiRouter.use("/prazos", prazosRouter);
apiRouter.use("/peticionamento", peticionamentoRouter);
apiRouter.use("/descoberta", descobertaRouter);
apiRouter.use("/auditoria", auditoriaRouter);
