/**
 * Escala de espaçamento do Figma.
 *
 * Todas as distâncias do arquivo caem nestes degraus. Usar um valor fora da
 * escala é sinal de que algo foi medido no olho em vez de lido do design.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Medidas fixas de componente, também lidas do arquivo. */
export const sizes = {
  /** Padding horizontal de qualquer tela. */
  pagePadding: spacing.xxl,
  /** Altura de input e de botão principal. */
  controlHeight: 52,
  /** Altura de botão secundário. */
  secondaryButtonHeight: 48,
  /** Lado do quadrado do ícone dentro de um input. */
  inputIcon: 20,
  /**
   * Lado do quadrado do checkbox.
   *
   * Abaixo do alvo mínimo de toque: quem desenha a linha do checkbox
   * compensa com `hitSlop`, como o olho da senha já faz.
   */
  checkbox: 24,
  /**
   * Alvo mínimo de toque.
   *
   * Não vem do Figma: é o mínimo recomendado pelas diretrizes de
   * acessibilidade da Apple e do Google para qualquer elemento tocável.
   */
  minTouchTarget: 44,
} as const;
