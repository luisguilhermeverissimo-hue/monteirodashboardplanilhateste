import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Regras de prazo iniciais - Espec. §9.1.
//
// ATENÇÃO: os valores do recurso de registro de candidatura (RECURSO_RRC)
// vêm de fontes secundárias (Res-TSE 23.609/2019, arts. 38 §8º, 63, 78) e
// AINDA NÃO foram validados contra o texto oficial da resolução - ver
// docs/especificacao-loy-integracao.md §13, item 4. Não usar em produção
// sem essa validação jurídica.
async function main() {
  await prisma.regraPrazo.upsert({
    where: { codigo: "ELEITORAL_PERIODO_ESPECIAL" },
    update: {},
    create: {
      codigo: "ELEITORAL_PERIODO_ESPECIAL",
      descricao:
        "Prazo eleitoral em período especial: dias corridos, contínuos e peremptórios (sem prorrogação para dia útil).",
      tipoContagem: "CORRIDO",
      quantidadeDias: 3,
      // Janela do ciclo eleitoral de 2026 (Res-TSE 23.760/2026) - Espec. §9.1.
      // Revisar a cada ciclo eleitoral; não é uma constante permanente.
      janelaInicio: new Date("2026-08-15T19:00:00-03:00"),
      janelaFim: new Date("2026-12-18T23:59:59-03:00"),
      fundamentoLegal: "Art. 16 da LC 64/90",
      exigeAlertaTermoAquo: false,
      ativo: true,
    },
  });

  await prisma.regraPrazo.upsert({
    where: { codigo: "RECURSO_REGISTRO_CANDIDATURA" },
    update: {},
    create: {
      codigo: "RECURSO_REGISTRO_CANDIDATURA",
      descricao:
        "Recurso em processo de registro de candidatura: prazo contínuo e peremptório contado da sessão de julgamento, não da disponibilização no PJe.",
      tipoContagem: "CORRIDO",
      quantidadeDias: 3,
      janelaInicio: null,
      janelaFim: null,
      fundamentoLegal: "Res-TSE 23.609/2019, arts. 38 §8º, 63 e 78 (pendente de validação no texto oficial)",
      exigeAlertaTermoAquo: true,
      ativo: true,
    },
  });

  await prisma.regraPrazo.upsert({
    where: { codigo: "ORDINARIA_CPC" },
    update: {},
    create: {
      codigo: "ORDINARIA_CPC",
      descricao: "Prazo ordinário fora do período eleitoral especial: dias úteis.",
      tipoContagem: "UTIL",
      quantidadeDias: 15,
      janelaInicio: null,
      janelaFim: null,
      fundamentoLegal: "Art. 219 do CPC",
      exigeAlertaTermoAquo: false,
      ativo: true,
    },
  });

  console.log("Regras de prazo (seed) aplicadas.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
