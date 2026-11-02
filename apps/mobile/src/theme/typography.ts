import type { TextStyle } from 'react-native';

import { colors } from './colors';

/**
 * Tipografia do Figma.
 *
 * Duas famílias, com papéis separados: **Outfit** no que é título ou ação,
 * **Manrope** no que é leitura.
 *
 * Os nomes abaixo são as chaves com que as fontes são registradas no
 * `useFonts` do layout raiz — no React Native o peso não se aplica a uma
 * fonte customizada com `fontWeight`: cada peso é um arquivo e um nome.
 */
export const fontFamilies = {
  outfitBold: 'Outfit_700Bold',
  outfitExtraBold: 'Outfit_800ExtraBold',
  manropeRegular: 'Manrope_400Regular',
  manropeMedium: 'Manrope_500Medium',
  manropeSemiBold: 'Manrope_600SemiBold',
  manropeBold: 'Manrope_700Bold',
} as const;

export const typography = {
  /** Título de tela, ex.: "Bem-vindo". */
  screenTitle: {
    fontFamily: fontFamilies.outfitExtraBold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.primaryDark,
  },
  /** Subtítulo logo abaixo do título. */
  screenSubtitle: {
    fontFamily: fontFamilies.manropeRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  /** Label acima de um campo. */
  label: {
    fontFamily: fontFamilies.manropeSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  /** Texto digitado dentro de um campo. */
  input: {
    fontFamily: fontFamilies.manropeRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  /** Texto de botão. */
  button: {
    fontFamily: fontFamilies.outfitBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Legenda e mensagem auxiliar. */
  caption: {
    fontFamily: fontFamilies.manropeRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSubtle,
  },
  /** Trecho clicável dentro de uma frase. */
  inlineLink: {
    fontFamily: fontFamilies.manropeBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  /** Texto comum do rodapé, ao redor do link. */
  footerText: {
    fontFamily: fontFamilies.manropeRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },

  /** Cabeçalho de seção, ex.: "Próximas sessões", "Agenda de hoje". */
  sectionTitle: {
    fontFamily: fontFamilies.outfitBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  /** Mês em foco no seletor do calendário. */
  monthTitle: {
    fontFamily: fontFamilies.outfitExtraBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
  },
  /** Número grande dentro do card da meta do dia. */
  cardTitle: {
    fontFamily: fontFamilies.outfitExtraBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.white,
  },
  /** Título de um item de sessão. */
  itemTitle: {
    fontFamily: fontFamilies.outfitBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  /** Linha de cima do badge de um item: a duração. */
  badgeStrong: {
    fontFamily: fontFamilies.manropeBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
  },
  /** Linha de baixo do badge: o prazo da avaliação. */
  badgeSoft: {
    fontFamily: fontFamilies.manropeRegular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSubtle,
  },
  /** Letra do dia da semana no cabeçalho da grade. */
  weekdayLabel: {
    fontFamily: fontFamilies.manropeBold,
    fontSize: 12,
    lineHeight: 20,
    color: colors.textSubtle,
  },
  /** Número do dia dentro da grade. */
  dayNumber: {
    fontFamily: fontFamilies.manropeMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  /** Rótulo da aba ativa na barra inferior. */
  tabLabelActive: {
    fontFamily: fontFamilies.manropeBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primary,
  },
  /** Rótulo da aba inativa. */
  tabLabel: {
    fontFamily: fontFamilies.manropeMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
} as const satisfies Record<string, TextStyle>;
