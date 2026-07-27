import { prisma } from "../db/client";
import { loyClient } from "../modules/loy/loyClient";

export interface ResultadoColeta {
  processoId: string;
  movimentosNovos: number;
  erro?: string;
}

// Motor de coleta (Camada 1, Espec. §3) para um único processo: consulta
// Movimentos/Documentos na Loy, grava o que for novo e cria uma Publicacao
// (entra no fluxo de triagem, Espec. §7) para cada movimento novo.
//
// Não decide prazo, não decide se o movimento é relevante - isso é trabalho
// do Saneador na triagem (Espec. §1, princípio orientador). Este módulo só
// evita duplicar o que já foi capturado (idempotência via constraint única
// processoId+loyMovementId no schema).
export async function collectProcesso(processoId: string, cnj: string): Promise<ResultadoColeta> {
  try {
    const movimentosLoy = await loyClient.getMovimentos(cnj);
    let movimentosNovos = 0;

    for (const m of movimentosLoy) {
      const existente = await prisma.movimento.findUnique({
        where: { processoId_loyMovementId: { processoId, loyMovementId: m.id } },
      });
      if (existente) continue;

      const movimento = await prisma.movimento.create({
        data: {
          processoId,
          loyMovementId: m.id,
          data: new Date(m.data),
          descricao: m.descricao,
          tipo: m.tipo,
        },
      });

      await prisma.publicacao.create({
        data: { processoId, movimentoId: movimento.id, status: "NOVA" },
      });

      movimentosNovos++;
    }

    const documentosLoy = await loyClient.getDocumentos(cnj);
    for (const d of documentosLoy) {
      await prisma.documento.upsert({
        where: { processoId_loyDocumentId: { processoId, loyDocumentId: d.file } },
        update: {},
        create: {
          processoId,
          loyDocumentId: d.file,
          nome: d.nome,
          secretLevel: d.secretLevel,
          // TODO (Fase 1): vínculo movimento<->documento depende de
          // confirmação da Loy sobre o campo `workload` - ver
          // docs/especificacao-loy-integracao.md §13 item 2. Download real
          // do binário (loyClient.downloadDocumentoFile) e armazenamento
          // criptografado ficam para a implementação completa da Fase 1.
        },
      });
    }

    if (movimentosNovos > 0) {
      await prisma.processo.update({
        where: { id: processoId },
        data: { ultimoEventoEm: new Date() },
      });
    }

    return { processoId, movimentosNovos };
  } catch (err) {
    return {
      processoId,
      movimentosNovos: 0,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}
