#!/usr/bin/env bash
# Prepara o ambiente para rodar localmente (fora do Claude Code remoto).
# Rode este script a partir da raiz do repositório, numa máquina com acesso
# normal à internet (ver docs/rodar-localmente.md).
#
# O que ele faz:
#   1. Confere a versão do Node.
#   2. Instala as dependências (npm install).
#   3. Cria apps/server/.env e apps/web/.env a partir dos .env.example,
#      SE eles ainda não existirem (nunca sobrescreve um .env já preenchido).
#   4. Gera um JWT_SECRET aleatório para o servidor.
#   5. Aplica as migrations do banco (SQLite) e roda o seed das regras de prazo.
#
# O que ele NÃO faz (de propósito):
#   - Não preenche LOY_API_BASE_URL/LOY_API_TOKEN. Isso você edita manualmente
#     em apps/server/.env, com o valor real - nunca deve ir para o Git.
#   - Não cria seu usuário de login (rode depois, ver a mensagem final).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Verificando Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale Node.js 20+ antes de continuar: https://nodejs.org"
  exit 1
fi
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js $(node -v) encontrado, mas é preciso 20 ou superior."
  exit 1
fi
echo "    Node $(node -v) ok."

echo "==> Instalando dependências (npm install)..."
npm install

if [ ! -f apps/server/.env ]; then
  echo "==> Criando apps/server/.env a partir do .env.example..."
  cp apps/server/.env.example apps/server/.env
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  # Substitui só o valor padrão do .env.example por um segredo gerado nesta máquina.
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" apps/server/.env
  else
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" apps/server/.env
  fi
  echo "    Criado. JWT_SECRET gerado automaticamente."
else
  echo "==> apps/server/.env já existe, não mexi nele."
fi

if [ ! -f apps/web/.env ]; then
  echo "==> Criando apps/web/.env a partir do .env.example..."
  cp apps/web/.env.example apps/web/.env
else
  echo "==> apps/web/.env já existe, não mexi nele."
fi

echo "==> Aplicando migrations do banco..."
npm run db:migrate --workspace=@monteiro/server -- --name init 2>/dev/null || \
  (cd apps/server && npx prisma migrate deploy)

echo "==> Rodando seed das regras de prazo..."
(cd apps/server && npx prisma db seed)

cat <<'EOF'

==================================================================
Setup local concluído. Falta só:

1. Editar apps/server/.env e colocar o token real:
     LOY_API_BASE_URL="..."
     LOY_API_TOKEN="..."
   (confirme a URL base com a documentação da Loy antes de rodar)

2. Criar seu usuário de login:
     npm run usuario:criar --workspace=@monteiro/server -- \
       --nome "Seu Nome" \
       --email "seu@email.com.br" \
       --senha "escolha-uma-senha" \
       --papeis SANEADOR,REDATOR,PETICIONANTE,ADMIN

3. Subir os dois serviços (em dois terminais):
     npm run dev:server
     npm run dev:web

4. Acessar http://localhost:5173/login
==================================================================
EOF
