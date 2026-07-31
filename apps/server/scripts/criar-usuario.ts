import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../src/modules/auth/password";
import { PAPEIS, type Papel } from "../src/types/dominio";

// Script de provisionamento de usuário. Não há tela de auto-cadastro por
// desenho (Espec. §6: papéis são atribuídos, não solicitados) - só um
// administrador com acesso ao servidor cria contas.
//
// Uso:
//   npx tsx scripts/criar-usuario.ts --nome "Nome Completo" --email "email@escritorio.com.br" \
//     --senha "senha-temporaria" --papeis SANEADOR,PETICIONANTE
//
// Papéis válidos: SANEADOR, REDATOR, PETICIONANTE, ADMIN (ver Espec. §6).
// O usuário deve trocar a senha temporária no primeiro acesso - troca de
// senha pela própria interface ainda não está implementada (TODO Fase 2).

const prisma = new PrismaClient();

function lerArgumento(nome: string): string | undefined {
  const idx = process.argv.indexOf(`--${nome}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const nome = lerArgumento("nome");
  const email = lerArgumento("email");
  const senha = lerArgumento("senha");
  const papeisArg = lerArgumento("papeis");

  if (!nome || !email || !senha || !papeisArg) {
    console.error(
      "Uso: npx tsx scripts/criar-usuario.ts --nome \"Nome\" --email \"email@escritorio.com.br\" --senha \"senha\" --papeis SANEADOR,PETICIONANTE"
    );
    process.exit(1);
  }

  const papeis = papeisArg.split(",").map((p) => p.trim().toUpperCase()) as Papel[];
  const papelInvalido = papeis.find((p) => !PAPEIS.includes(p));
  if (papelInvalido) {
    console.error(`Papel inválido: ${papelInvalido}. Válidos: ${PAPEIS.join(", ")}`);
    process.exit(1);
  }

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { nome, senhaHash: hashSenha(senha) },
    create: { nome, email, senhaHash: hashSenha(senha) },
  });

  for (const papel of papeis) {
    const existente = await prisma.papelUsuario.findFirst({
      where: { usuarioId: usuario.id, papel, processoId: null },
    });
    if (!existente) {
      await prisma.papelUsuario.create({ data: { usuarioId: usuario.id, papel } });
    }
  }

  console.log(`Usuário criado/atualizado: ${usuario.email} (papéis: ${papeis.join(", ")})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
