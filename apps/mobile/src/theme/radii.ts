/** Raios de canto do Figma. */
export const radii = {
  /** Input e botão. */
  control: 12,
  /** Card. */
  card: 16,
  /** Card grande: o da meta do dia e o do calendário. */
  cardLarge: 24,
  /** Círculo do número do dia na grade do calendário (28 de lado). */
  ring: 14,
  /** Pílula: badge e barra de progresso. */
  pill: 100,
  /**
   * Quadrado do checkbox.
   *
   * Menor que o raio de controle de propósito: um quadrado de 24 com raio 12
   * vira círculo, e círculo é rádio, não caixa de marcação.
   */
  checkbox: 6,
} as const;
