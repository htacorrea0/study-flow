import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon, type IconProps } from '@/components/icons';
import { colors, radii, sizes, spacing, typography } from '@/theme';

type ListRowProps = {
  readonly title: string;
  /** Segunda linha: "3 provas", "Prova em 5 dias". */
  readonly subtitle?: string | undefined;
  /** Ponto colorido à esquerda, na cor da matéria. Ausente = sem ponto. */
  readonly color?: string | null | undefined;
  /** Ícone no lugar do ponto, para as linhas que não são matéria. */
  readonly icon?: ComponentType<IconProps> | undefined;
  readonly onPress: () => void;
  /** Troca o chevron por outro indicador, ex.: nenhum. */
  readonly showChevron?: boolean;
};

const PONTO = 10;

/**
 * Linha de lista pressionável.
 *
 * É a geometria do item de sessão do calendário (`5:885`) generalizada: card
 * branco de raio 16, ponto da cor da matéria à esquerda, título e apoio no
 * meio, chevron à direita. Serve à lista de matérias, à de provas e ao
 * atalho de disponibilidade, que são as três listas desta etapa.
 */
export function ListRow({
  title,
  subtitle,
  color,
  icon: Icon,
  onPress,
  showChevron = true,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle === undefined ? title : `${title}. ${subtitle}`}
      style={({ pressed }) => [styles.linha, pressed ? styles.pressed : null]}
    >
      {Icon === undefined ? (
        <View
          style={[styles.ponto, { backgroundColor: color ?? colors.border }]}
          // Decorativo: a cor repete o que o título já diz.
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : (
        <Icon size={sizes.inputIcon} color={colors.primary} />
      )}

      <View style={styles.textos}>
        <Text style={styles.titulo} numberOfLines={1}>
          {title}
        </Text>
        {subtitle === undefined ? null : <Text style={styles.apoio}>{subtitle}</Text>}
      </View>

      {showChevron ? <ChevronRightIcon size={sizes.inputIcon} color={colors.textSubtle} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.minTouchTarget + spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  ponto: {
    borderRadius: PONTO / 2,
    height: PONTO,
    width: PONTO,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    ...typography.itemTitle,
  },
  apoio: {
    ...typography.caption,
  },
});
