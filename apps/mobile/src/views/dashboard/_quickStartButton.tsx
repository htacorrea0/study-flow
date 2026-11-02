import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArrowRightIcon, PlayIcon } from '@/components/icons';
import { colors, fontFamilies, radii, spacing } from '@/theme';

type QuickStartButtonProps = {
  readonly onPress: () => void;
};

const ROTULO = 'Iniciar sessão de estudo';

/**
 * Botão verde do nó `5:112`.
 *
 * Leva para a aba Timer, que ainda é uma tela em branco. Mandar para uma
 * tela que se declara inacabada é mais honesto do que simular um cronômetro
 * que não existe, e o botão está no Figma.
 */
export function QuickStartButton({ onPress }: QuickStartButtonProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={ROTULO}
        style={({ pressed }) => [styles.botao, pressed ? styles.pressed : null]}
      >
        <PlayIcon size={20} color={colors.success} />
        <Text style={styles.rotulo}>{ROTULO}</Text>
        <ArrowRightIcon size={16} color={colors.success} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  botao: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
  rotulo: {
    color: colors.success,
    fontFamily: fontFamilies.outfitBold,
    fontSize: 16,
    lineHeight: 24,
  },
});
