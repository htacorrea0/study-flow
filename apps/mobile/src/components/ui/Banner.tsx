import { StyleSheet, Text, View } from 'react-native';

import { AlertTriangleIcon, CheckIcon, type IconProps } from '@/components/icons';
import { colors, radii, sizes, spacing, typography } from '@/theme';

import type { ComponentType } from 'react';

type BannerTone = 'info' | 'warning';

type BannerProps = {
  readonly tone?: BannerTone;
  readonly message: string;
};

/**
 * Aviso curto dentro da tela.
 *
 * Existe para o resultado da redistribuição: "o que você não estudou foi
 * remarcado" é informação, e "isso não cabe no seu tempo livre" é alerta. Os
 * dois precisam ficar na tela até a pessoa ler, o que descarta um toast.
 *
 * Nenhum dos dois tons usa `danger`: nada aqui deu errado. O vermelho do app
 * é reservado para erro de formulário e ação destrutiva.
 */
export function Banner({ tone = 'info', message }: BannerProps) {
  const aviso = tone === 'warning';
  const Icone: ComponentType<IconProps> = aviso ? AlertTriangleIcon : CheckIcon;

  return (
    <View
      style={[styles.caixa, aviso ? styles.aviso : styles.info]}
      accessibilityLiveRegion="polite"
      role="status"
    >
      <Icone size={sizes.inputIcon} color={aviso ? colors.amber : colors.success} />
      <Text style={styles.texto}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    alignItems: 'flex-start',
    borderRadius: radii.card,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  info: {
    backgroundColor: colors.successSoft,
  },
  aviso: {
    backgroundColor: colors.roseSoft,
  },
  texto: {
    ...typography.caption,
    color: colors.ink,
    flex: 1,
  },
});
