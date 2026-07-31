# Rodando localmente com a API Loy real

Este guia é para rodar o sistema **fora** do ambiente remoto do Claude Code
(que tem uma política de rede que bloqueia `api.loylegal.com` e
`docs.loylegal.com`). Rode isto numa máquina/servidor do escritório com
acesso normal à internet.

## 0. Antes de começar

- **Confirme o contrato exato do módulo Trust** em
  `https://docs.loylegal.com/home/trust/` antes de testar. A implementação
  atual em `apps/server/src/modules/loy/loyClient.ts` foi escrita a partir da
  tabela de endpoints da especificação (`docs/especificacao-loy-integracao.md`
  §5), **não** da documentação oficial confirmada — não consegui ler essa
  página a partir do ambiente remoto (rede bloqueada, ver conversa). Em
  particular, verifique se as chamadas de Consulta/Peticionamento usam o
  token principal diretamente no header `Authorization`, ou se é preciso
  primeiro chamar `access-external` para obter uma sessão por tribunal e usar
  *essa* sessão nas chamadas seguintes. Se for o segundo caso, o código
  precisa de ajuste antes de funcionar de ponta a ponta — me avise (cole o
  trecho relevante da doc aqui) que eu ajusto o `loyClient.ts`.
- **Gere um token de homologação/consulta, não um de produção com permissão
  de peticionamento**, se a Loy permitir - ver
  `docs/loy-integration-security-review.md` §1.1.
- Se o token que você já tem der erro de autenticação, gere um novo: no
  exemplo testado nesta conversa, os campos `iat`/`exp` do JWT vieram
  **idênticos**, o que sugere que ele pode já estar expirado ou que a
  validade real é controlada de outra forma pelo servidor da Loy (não pelo
  `exp` do próprio JWT) - vale confirmar com o suporte da Loy.

## 1. Pré-requisitos

- Node.js 20+
- Este repositório clonado, na branch `claude/loy-api-integration-spec-swq4nl`

## 2. Rodar o script de setup

A partir da raiz do repositório:

```bash
bash scripts/setup-local.sh
```

Isso instala as dependências, cria os arquivos `.env` de cada app (a partir
dos `.env.example`, sem sobrescrever se já existirem), gera um `JWT_SECRET`
aleatório, aplica as migrations do banco e roda o seed das regras de prazo.
Ele **não** preenche o token da Loy nem cria seu usuário — isso é manual, nos
passos abaixo.

Se preferir fazer manualmente em vez de rodar o script:

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

## 3. Configurar o token da Loy

Edite `apps/server/.env`:

- `LOY_API_BASE_URL` — confirme com a doc da Loy (o padrão do exemplo é
  `https://api.loylegal.com`).
- `LOY_API_TOKEN` — seu token real (o de homologação/consulta, ver acima).
- `JWT_SECRET` — se você rodou `scripts/setup-local.sh`, já foi gerado
  automaticamente; se preencheu o `.env` manualmente, gere um valor com
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

O `apps/web/.env` pode ficar com o valor padrão (`http://localhost:3333/api`)
se você for rodar tudo na mesma máquina.

Se você não rodou `scripts/setup-local.sh` no passo 2, aplique as migrations
e o seed manualmente antes de continuar:

```bash
npm run db:migrate --workspace=@monteiro/server
npx prisma db seed --schema apps/server/prisma/schema.prisma
```

(grava as regras de prazo iniciais — Espec. §9.1; lembrando que a regra do
recurso de registro de candidatura ainda não foi validada contra o texto
oficial da Res-TSE 23.609/2019, ver `docs/especificacao-loy-integracao.md`
§13 item 4).

## 4. Criar seu usuário

Não existe tela de auto-cadastro (Espec. §6 — papéis são atribuídos por um
administrador, não solicitados). Use o script:

```bash
npm run usuario:criar --workspace=@monteiro/server -- \
  --nome "Luís Guilherme Veríssimo de Andrade" \
  --email "luis@monteiroadvogados.com.br" \
  --senha "escolha-uma-senha-forte" \
  --papeis SANEADOR,REDATOR,PETICIONANTE,ADMIN
```

Troque a senha por uma real; este script pode ser rodado de novo a qualquer
momento para criar outros usuários do escritório (com os papéis que fizerem
sentido para cada pessoa — Espec. §6).

## 5. Subir os dois serviços

Em dois terminais separados, a partir da raiz do repositório:

```bash
npm run dev:server   # http://localhost:3333
npm run dev:web      # http://localhost:5173
```

## 6. Testar a consulta real

1. Acesse `http://localhost:5173/login` e entre com o usuário criado no
   passo 4.
2. Vá em **Consulta avulsa** (Espec. §10.3) na barra lateral.
3. Digite um número CNJ real e clique em Consultar — isso chama
   `POST /api/acervo/consulta-avulsa` no servidor-ponte, que por sua vez
   chama a Loy (`process/capture`, `process/{cnj}`, `movements/{id}`,
   `documents/{id}`) usando o token do `.env`. O resultado (capa, movimentos,
   documentos) aparece na tela.
4. Se quiser manter o processo no acervo, use o botão **Promover ao acervo**.

## 7. Se der erro

- **401/403 vindo da Loy**: token inválido, expirado, ou sem permissão para
  o módulo chamado — confirme o token e o escopo com a Loy.
- **CORS bloqueando no navegador**: confirme que `WEB_ORIGIN` em
  `apps/server/.env` é exatamente a URL de onde a interface está rodando
  (`http://localhost:5173` por padrão).
- **Erro de formato/campo inesperado na resposta da Loy**: os tipos em
  `loyClient.ts` (`LoyProcessoCapa`, `LoyMovimento`, `LoyDocumento`, etc.) são
  melhor esforço a partir da especificação, não da doc oficial — cole aqui o
  payload real de erro/resposta que a Loy retornou e eu ajusto o cliente.
