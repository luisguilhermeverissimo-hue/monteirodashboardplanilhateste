import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export function assinarToken(usuario: UsuarioAutenticado): string {
  return jwt.sign(usuario, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

// Autenticação por sessão individual (nunca login compartilhado) - ver
// docs/loy-integration-security-review.md §1.3. Este middleware só valida
// identidade; a checagem de PAPEL/permissão é feita em middleware/rbac.ts,
// por rota, no servidor - nunca apenas escondida na interface (§1.1).
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as UsuarioAutenticado;
    req.usuario = { id: payload.id, nome: payload.nome, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: "Sessão inválida ou expirada" });
  }
}
