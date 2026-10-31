/**
 * Fuso horário do aparelho, no formato IANA (ex.: `America/Sao_Paulo`).
 *
 * O cadastro envia esse valor para preencher o campo `timezone` que o modelo
 * `User` já tem: é o fuso em que o planejamento de estudos vai calcular datas
 * e disparar lembretes. Sem ele, quem estuda fora do horário de Brasília
 * receberia o lembrete na hora errada.
 *
 * O suporte a `Intl` depende do motor JavaScript e da build do app, então a
 * leitura é defensiva: se falhar ou vier vazia, o campo é omitido e o
 * servidor aplica o padrão dele.
 */
export function resolveDeviceTimezone(): string | undefined {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone.length > 0 ? timezone : undefined;
  } catch {
    return undefined;
  }
}
