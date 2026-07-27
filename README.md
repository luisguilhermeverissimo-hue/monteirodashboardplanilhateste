# Monteiro Processual — Monitoramento, Saneamento e Peticionamento

Sistema interno da Monteiro e Monteiro Advogados Associados para monitoramento automático de processos, fluxo de triagem/redação/peticionamento entre papéis, motor de prazos e integração com a API Loy.

Este repositório também contém, na raiz (`index.html`), o dashboard de atendimentos eleitorais já existente — não relacionado a este sistema; não editar por engano.

A especificação funcional completa e a revisão de segurança estão em `docs/`:
- [`docs/especificacao-loy-integracao.md`](docs/especificacao-loy-integracao.md) — especificação funcional (fonte da verdade do que construir)
- [`docs/loy-integration-security-review.md`](docs/loy-integration-security-review.md) — addendum de segurança, LGPD, pendências e checklist por fase

## Arquitetura (3 camadas, ver especificação §3)

```
apps/
  server/   Camada 1 (motor de coleta / cron) + Camada 2 (servidor-ponte / API)
  web/      Camada 3 (interface React)
```

O `apps/web` **nunca** fala diretamente com a API Loy — sempre via `apps/server`. O token da Loy vive exclusivamente em `apps/server` (variável de ambiente, ver `apps/server/.env.example`), nunca no bundle do frontend.

## Stack

| Camada | Tecnologia |
|---|---|
| Servidor-ponte / motor de coleta | Node.js + TypeScript + Express |
| Banco de dados | SQLite via Prisma ORM |
| Interface | React + TypeScript + Vite |

> **Nota sobre SQLite:** adequado para desenvolvimento e para o volume inicial do acervo. Como a trilha de auditoria (Espec. §8) e o uso concorrente de múltiplos papéis crescem com o acervo, reavaliar migração para PostgreSQL antes de produção com uso multiusuário intenso — a revisão de segurança (`docs/loy-integration-security-review.md`, §1.5) descreve os requisitos de append-only/hash-chain que a migração deve preservar. Usar Prisma desde já reduz o custo dessa migração no futuro.

## Como rodar em desenvolvimento

Pré-requisitos: Node.js 20+.

```bash
npm install

# Banco local (gera apps/server/prisma/dev.db)
npm run db:migrate --workspace=@monteiro/server

# Dois terminais:
npm run dev:server   # servidor-ponte em http://localhost:3333
npm run dev:web      # interface em http://localhost:5173
```

Copie `apps/server/.env.example` para `apps/server/.env` e preencha as variáveis antes de subir o servidor (ver comentários no arquivo — nenhuma delas deve ter valor real de produção em ambiente de desenvolvimento).

## Estrutura de módulos do servidor (`apps/server/src/modules`)

Cada módulo corresponde a uma responsabilidade da especificação:

| Módulo | Espec. | Responsabilidade |
|---|---|---|
| `auth` | §6 | Autenticação e sessão |
| `acervo` | §10.1, §10.4 | CRUD do acervo de processos |
| `publicacoes` | §7 | Máquina de estados da publicação |
| `prazos` | §9 | Motor de prazos (regras configuráveis, não hardcoded — ver revisão de segurança §3) |
| `peticionamento` | §5, §10.8 | Integração com módulo de Peticionamento da Loy |
| `descoberta` | §10.5 | Sugestões da Descoberta de Processos |
| `auditoria` | §8 | Trilha de auditoria append-only |
| `loy` | §5 | Cliente HTTP da API Loy (único ponto de saída autorizado) |

O `collector` (`apps/server/src/collector`) roda como processo separado do servidor HTTP (Camada 1 da especificação é isolada da Camada 2 por design — ver `docs/loy-integration-security-review.md` §1.2).

## Papéis e autorização

A autorização por papel (Saneador/Redator/Peticionante, Espec. §6) é aplicada **no servidor**, por rota, via `src/middleware/rbac.ts` — nunca apenas escondendo botões na interface. Ver `docs/loy-integration-security-review.md` §1.1.

## Roadmap (Espec. §12)

O scaffold atual cobre a estrutura de todas as fases (schema de dados e stubs de rota), mas a implementação segue a ordem:

1. **Fase 1** — Núcleo de monitoramento (leitura apenas): importação de planilha, collector, Acervo + Feed
2. **Fase 2** — Papéis, máquina de estados, auditoria, gestão de prazos
3. **Fase 3** — Peticionamento integrado
4. **Fase 4** — Descoberta de processos + consulta avulsa
5. **Fase 5** — Refinamentos

## Segurança

Antes de implementar cada fase, revisar o checklist correspondente em `docs/loy-integration-security-review.md` §5 — os controles (secret manager, MFA, autorização no servidor, auditoria append-only) devem entrar junto com a funcionalidade, não depois.
