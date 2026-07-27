import { describe, expect, it } from "vitest";
import type { RegraPrazo } from "@prisma/client";
import { calcularSugestaoPrazo, regraVigentePara } from "./prazoEngine";

function regra(overrides: Partial<RegraPrazo>): RegraPrazo {
  return {
    id: "regra-teste",
    codigo: "TESTE",
    descricao: "",
    tipoContagem: "CORRIDO",
    quantidadeDias: 3,
    janelaInicio: null,
    janelaFim: null,
    fundamentoLegal: "",
    exigeAlertaTermoAquo: false,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

describe("motor de prazos", () => {
  it("conta dias corridos incluindo fim de semana (regra eleitoral)", () => {
    const r = regra({ tipoContagem: "CORRIDO", quantidadeDias: 3 });
    // sexta-feira 2026-08-21 + 3 dias corridos = segunda 2026-08-24
    const sugestao = calcularSugestaoPrazo(r, new Date("2026-08-21T00:00:00Z"));
    expect(sugestao.dataSugerida.toISOString().slice(0, 10)).toBe("2026-08-24");
  });

  it("conta dias úteis pulando fim de semana (regra ordinária)", () => {
    const r = regra({ tipoContagem: "UTIL", quantidadeDias: 3 });
    // sexta-feira 2026-08-21 + 3 dias úteis = quarta 2026-08-26 (pula sáb/dom)
    const sugestao = calcularSugestaoPrazo(r, new Date("2026-08-21T00:00:00Z"));
    expect(sugestao.dataSugerida.toISOString().slice(0, 10)).toBe("2026-08-26");
  });

  it("pula feriados na contagem em dias úteis", () => {
    const feriado = new Date("2026-08-24T00:00:00Z"); // segunda declarada feriado
    const r = regra({ tipoContagem: "UTIL", quantidadeDias: 3 });
    const sugestao = calcularSugestaoPrazo(r, new Date("2026-08-21T00:00:00Z"), [feriado]);
    expect(sugestao.dataSugerida.toISOString().slice(0, 10)).toBe("2026-08-27");
  });

  it("sinaliza alertaTermoAquo quando a regra exige (Espec. §9.2)", () => {
    const r = regra({ exigeAlertaTermoAquo: true });
    const sugestao = calcularSugestaoPrazo(r, new Date("2026-09-01T00:00:00Z"));
    expect(sugestao.alertaTermoAquo).toBe(true);
  });

  it("considera regra fora de vigência antes da janela eleitoral", () => {
    const r = regra({
      janelaInicio: new Date("2026-08-15T19:00:00-03:00"),
      janelaFim: new Date("2026-12-18T23:59:59-03:00"),
    });
    expect(regraVigentePara(r, new Date("2026-07-01T00:00:00Z"))).toBe(false);
    expect(regraVigentePara(r, new Date("2026-09-01T00:00:00Z"))).toBe(true);
    expect(regraVigentePara(r, new Date("2026-12-31T00:00:00Z"))).toBe(false);
  });
});
