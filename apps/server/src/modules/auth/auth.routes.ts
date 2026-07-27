import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { assinarToken, requireAuth } from "../../middleware/auth";
import { verificarSenha } from "./password";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

// TODO (Fase 2): MFA obrigatório para o papel Peticionante antes de produção
// - ver docs/loy-integration-security-review.md §1.3. Este endpoint cobre
// apenas o primeiro fator.
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: "Credenciais inválidas" });
  }

  const { email, senha } = parsed.data;
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Mensagem genérica de propósito: não revelar se o e-mail existe ou não.
  if (!usuario || !usuario.ativo || !verificarSenha(senha, usuario.senhaHash)) {
    return res.status(401).json({ erro: "Credenciais inválidas" });
  }

  const token = assinarToken({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const papeis = await prisma.papelUsuario.findMany({
    where: { usuarioId: req.usuario!.id },
    select: { papel: true, processoId: true },
  });
  res.json({ usuario: req.usuario, papeis });
});
