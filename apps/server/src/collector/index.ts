import cron from "node-cron";
import { env } from "../config/env";
import { prisma } from "../db/client";
import { collectProcesso } from "./collectProcesso";

// Motor de coleta (Camada 1, Espec. §3) - processo separado do servidor HTTP,
// roda sozinho, sem interface, sem decidir prazo ou conteúdo.
//
// Grava um heartbeat (CollectorRun) a cada ciclo. Falha silenciosa é o risco
// central desta camada (ver docs/loy-integration-security-review.md §1.2):
// um ciclo que não completa, ou uma taxa de erro alta, precisa gerar alerta
// visível, não só um log que ninguém olha. O alerta por e-mail em caso de
// falha é um TODO da Fase 1 - hoje o heartbeat só fica registrado no banco
// para a página de status prevista na revisão de segurança §4.
async function executarCiclo() {
  const run = await prisma.collectorRun.create({ data: { status: "EM_ANDAMENTO" } });

  const processos = await prisma.processo.findMany({ where: { status: "ATIVO" } });
  let erros = 0;

  for (const processo of processos) {
    const resultado = await collectProcesso(processo.id, processo.cnj);
    if (resultado.erro) {
      erros++;
      console.error(`[collector] erro ao coletar ${processo.cnj}: ${resultado.erro}`);
    } else if (resultado.movimentosNovos > 0) {
      console.log(`[collector] ${processo.cnj}: ${resultado.movimentosNovos} movimento(s) novo(s)`);
    }
  }

  await prisma.collectorRun.update({
    where: { id: run.id },
    data: {
      finalizadoEm: new Date(),
      status: erros > 0 ? "ERRO" : "SUCESSO",
      processosVerificados: processos.length,
      erros,
    },
  });

  // TODO (Fase 1): alertar (e-mail) quando erros/processos.length ultrapassar
  // um limiar, e quando o ciclo anterior não tiver completado no horário
  // esperado - ver docs/loy-integration-security-review.md §1.2.
}

console.log(`[collector] agendado com cron "${env.COLLECTOR_CRON}"`);
cron.schedule(env.COLLECTOR_CRON, () => {
  executarCiclo().catch((err) => console.error("[collector] falha não tratada no ciclo:", err));
});

// Executa um ciclo imediatamente ao subir o processo, além do agendamento.
executarCiclo().catch((err) => console.error("[collector] falha não tratada no ciclo inicial:", err));
