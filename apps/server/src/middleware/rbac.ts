import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/client";
import type { Papel } from "../types/dominio";

// Autorização por papel aplicada NO SERVIDOR, por rota - Espec. §6.
//
// Esta é a resposta direta ao risco descrito em
// docs/loy-integration-security-review.md §1.1: a matriz de papéis não pode
// depender de "o botão não aparece na tela". Toda rota sensível (confirmar
// prazo, criar intermediate na Loy, abrir janela de assinatura, etc.) deve
// usar requirePapel() aqui, não apenas confiar no que a interface manda.
//
// Papel pode ser global (PapelUsuario.processoId nulo) ou restrito a um
// processo específico (Espec. §6: "um mesmo usuário pode acumular papéis
// diferentes em processos diferentes"). Quando a rota tem :processoId (ou
// resolveProcessoId extrai o id de outro lugar, ex.: a partir de uma
// publicação), a checagem é escopada a esse processo.
export function requirePapel(
  papeisPermitidos: Papel[],
  resolveProcessoId?: (req: Request) => string | undefined | Promise<string | undefined>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: "Não autenticado" });
    }

    const processoId = await resolveProcessoId?.(req);

    const papel = await prisma.papelUsuario.findFirst({
      where: {
        usuarioId: req.usuario.id,
        papel: { in: papeisPermitidos },
        OR: [{ processoId: null }, ...(processoId ? [{ processoId }] : [])],
      },
    });

    if (!papel) {
      return res.status(403).json({ erro: "Usuário não tem papel autorizado para esta ação" });
    }

    next();
  };
}
