/**
 * Paleta do Study Flow, lida diretamente do Figma.
 *
 * O arquivo de design não define Figma Variables — os estilos são aplicados
 * direto nas camadas. Estes nomes são a tradução daquilo em tokens, e são o
 * único lugar do app onde um hexadecimal pode aparecer.
 */
export const colors = {
  /** Fundo de todas as telas. Off-white quente, não branco puro. */
  canvas: '#faf9f5',
  /** Superfície elevada: inputs, cards, botões secundários. */
  surface: '#ffffff',

  /** Ação principal, links e ícone de navegação ativo. */
  primary: '#4f46e5',
  /** Títulos de tela. */
  primaryDark: '#3730a3',

  /** Texto forte: label de campo e valor digitado. */
  ink: '#1e1b4b',
  /** Texto de apoio: subtítulos. */
  textMuted: '#475569',
  /** Texto discreto: placeholder e legendas. */
  textSubtle: '#94a3b8',

  /** Borda de input e de card. */
  border: '#e2e8f0',

  /** Confirmação e ação de estudo. */
  success: '#10b981',
  successSoft: '#e6fdf4',

  /**
   * Erro de formulário.
   *
   * Único valor que NÃO vem do Figma: o arquivo não tem nenhuma tela em
   * estado de erro. É o vermelho 600 da mesma escala Tailwind de onde vêm os
   * cinzas e o índigo do design, escolhido para não destoar.
   */
  danger: '#dc2626',

  white: '#ffffff',
} as const;

export type ColorToken = keyof typeof colors;
