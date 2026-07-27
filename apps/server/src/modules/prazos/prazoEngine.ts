import type { RegraPrazo } from "@prisma/client";

// Motor de prazos - Espec. §9.
//
// Importante: as regras (quantidade de dias, tipo de contagem, janela de
// vigência) vêm do banco (model RegraPrazo), não são constantes aqui - ver
// docs/loy-integration-security-review.md §3/§4. Este módulo só sabe
// *calcular* a partir de uma regra; decidir qual regra se aplica a um
// processo/evento é responsabilidade de quem chama (módulo publicacoes),
// olhando a natureza jurídica do processo e a janela de vigência da regra.
//
// O resultado deste motor é sempre uma SUGESTÃO (Espec. §9.3) - nunca grava
// um prazo confirmado sozinho.

export interface SugestaoPrazo {
  regraAplicadaCodigo: string;
  dataSugerida: Date;
  alertaTermoAquo: boolean;
}

function isFimDeSemana(data: Date): boolean {
  const dia = data.getUTCDay();
  return dia === 0 || dia === 6;
}

function isFeriado(data: Date, feriados: Date[]): boolean {
  return feriados.some(
    (f) =>
      f.getUTCFullYear() === data.getUTCFullYear() &&
      f.getUTCMonth() === data.getUTCMonth() &&
      f.getUTCDate() === data.getUTCDate()
  );
}

function addDiasCorridos(inicio: Date, dias: number): Date {
  const resultado = new Date(inicio);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function addDiasUteis(inicio: Date, dias: number, feriados: Date[]): Date {
  const resultado = new Date(inicio);
  let restantes = dias;
  while (restantes > 0) {
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    if (!isFimDeSemana(resultado) && !isFeriado(resultado, feriados)) {
      restantes--;
    }
  }
  return resultado;
}

// Verifica se a data do evento cai dentro da janela de vigência de uma regra
// especial (ex.: período eleitoral - Espec. §9.1). Regras sem janela
// definida (janelaInicio/janelaFim nulos) são sempre consideradas vigentes.
export function regraVigentePara(regra: RegraPrazo, dataEvento: Date): boolean {
  if (regra.janelaInicio && dataEvento < regra.janelaInicio) return false;
  if (regra.janelaFim && dataEvento > regra.janelaFim) return false;
  return true;
}

export function calcularSugestaoPrazo(
  regra: RegraPrazo,
  dataEvento: Date,
  feriados: Date[] = []
): SugestaoPrazo {
  const dataSugerida =
    regra.tipoContagem === "CORRIDO"
      ? addDiasCorridos(dataEvento, regra.quantidadeDias)
      : addDiasUteis(dataEvento, regra.quantidadeDias, feriados);

  return {
    regraAplicadaCodigo: regra.codigo,
    dataSugerida,
    // Espec. §9.2: quando a regra exige o alerta de termo a quo (ex.: recurso
    // de registro de candidatura), a data acima é apenas um ponto de partida
    // calculado a partir do movimento capturado - o Saneador deve confirmar
    // a data real da sessão de julgamento antes de aceitar a sugestão.
    alertaTermoAquo: regra.exigeAlertaTermoAquo,
  };
}
