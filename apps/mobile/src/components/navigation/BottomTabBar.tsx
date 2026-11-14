import type { FC } from 'react';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BarChartIcon,
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  HomeIcon,
  type IconProps,
} from '@/components/icons';
import { colors, darkColors, radii, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

/** Ícone de cada aba, pela pasta da rota. */
const ICONES: Record<string, FC<IconProps>> = {
  index: HomeIcon,
  materias: BookOpenIcon,
  calendario: CalendarIcon,
  timer: ClockIcon,
  progresso: BarChartIcon,
};

const ALTURA = 72;
const LADO_DO_ICONE = 20;

/**
 * Barra de abas do nó `5:1108`.
 *
 * O Figma desenha quatro abas de 76 de largura com `justify-between`. São
 * cinco aqui, por decisão de produto, e cinco vezes 76 não cabe nos 370
 * úteis: cada aba passa a dividir a largura em partes iguais. Altura 72,
 * glow de `px 16 py 4` com raio 16, ícone 20 e rótulo 11 seguem idênticos.
 *
 * A aba ativa muda três coisas ao mesmo tempo (fundo do glow, cor do ícone e
 * peso do rótulo), porque cor sozinha não é sinal acessível.
 */
export function BottomTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={[
      styles.bar,
      {
        backgroundColor: palette.surface,
        borderTopColor: palette.border,
        paddingBottom: insets.bottom,
      },
    ]}>
      {state.routes.map((route, indice) => {
        const options = descriptors[route.key]?.options;
        const label = options?.title ?? route.name;
        const Icone = ICONES[route.name] ?? HomeIcon;
        const ativo = state.index === indice;

        return (
          <Pressable
            key={route.key}
            onPress={() => navigateToTab(route.key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: ativo }}
            style={styles.tab}
          >
            <View style={[styles.glow, ativo ? { backgroundColor: palette.primaryGlow } : null]}>
              <Icone
                size={LADO_DO_ICONE}
                color={ativo ? colors.primary : palette.textMuted}
              />
            </View>
            <Text
              style={[
                ativo ? styles.labelActive : styles.label,
                isDark && { color: ativo ? '#a5b4fc' : palette.textMuted },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    height: ALTURA,
    justifyContent: 'center',
  },
  glow: {
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  glowActive: {
    backgroundColor: colors.primaryGlow,
  },
  label: {
    ...typography.tabLabel,
  },
  labelActive: {
    ...typography.tabLabelActive,
  },
});
