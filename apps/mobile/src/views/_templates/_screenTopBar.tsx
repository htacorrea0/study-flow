import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronLeftIcon, type IconProps } from '@/components/icons';
import { colors, darkColors, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type ScreenTopBarProps = {
  readonly title: string;
  /** Ausente = sem botão de voltar, para a raiz de uma pilha. */
  readonly onBack?: (() => void) | undefined;
  /** Ícone do botão à direita. Sem ele, o lugar fica vazio. */
  readonly actionIcon?: ComponentType<IconProps> | undefined;
  readonly actionLabel?: string | undefined;
  readonly onAction?: (() => void) | undefined;
  /** Conteúdo livre abaixo do título, ex.: um Banner. */
  readonly children?: ReactNode;
};

const LADO_DO_BOTAO = 40;

/**
 * Cabeçalho das telas empilhadas.
 *
 * `headerShown: false` vale no app inteiro, porque o cabeçalho nativo não
 * desenha o que o Figma pede. Cada tela empilhada precisa então do próprio
 * topo, e repetir a geometria em cada uma seria pedir para elas divergirem.
 *
 * A caixa de 40, a altura de 48 e o respiro lateral são os mesmos do
 * cabeçalho do calendário (`5:885`), que é de onde este template saiu.
 */
export function ScreenTopBar({
  title,
  onBack,
  actionIcon: ActionIcon,
  actionLabel,
  onAction,
  children,
}: ScreenTopBarProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={styles.bloco}>
      <View style={styles.barra}>
        {onBack === undefined ? (
          <View style={styles.vazio} />
        ) : (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [
              styles.botao,
              { backgroundColor: palette.surface, borderColor: palette.border },
              pressed ? styles.pressed : null,
            ]}
          >
            <ChevronLeftIcon size={20} color={palette.ink} />
          </Pressable>
        )}

        <Text style={[styles.titulo, { color: palette.ink }]} numberOfLines={1}>
          {title}
        </Text>

        {ActionIcon === undefined || onAction === undefined ? (
          <View style={styles.vazio} />
        ) : (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? 'Ação'}
            style={({ pressed }) => [
              styles.botao,
              { backgroundColor: palette.surface, borderColor: palette.border },
              pressed ? styles.pressed : null,
            ]}
          >
            <ActionIcon size={20} color={palette.ink} />
          </Pressable>
        )}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: spacing.md,
  },
  barra: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    height: 48,
    justifyContent: 'space-between',
  },
  titulo: {
    ...typography.sectionTitle,
    flex: 1,
    textAlign: 'center',
  },
  botao: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: LADO_DO_BOTAO / 2,
    borderWidth: 1,
    height: LADO_DO_BOTAO,
    justifyContent: 'center',
    width: LADO_DO_BOTAO,
  },
  // Mantém o título centrado quando um dos lados não tem botão.
  vazio: {
    height: LADO_DO_BOTAO,
    width: LADO_DO_BOTAO,
  },
  pressed: {
    opacity: 0.7,
  },
  botaoEscuro: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  textoClaro: {
    color: '#f8fafc',
  },
});
