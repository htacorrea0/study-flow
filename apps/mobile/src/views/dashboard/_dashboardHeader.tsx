import type { DashboardUser } from '@study-flow/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FlameIcon } from '@/components/icons';
import { Avatar } from '@/components/ui';
import { colors, darkColors, fontFamilies, radii, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type DashboardHeaderProps = {
  readonly user: DashboardUser;
  readonly streakDays: number;
  readonly onProfile: () => void;
};

const LADO_DO_ICONE = 16;

/**
 * Cabeçalho do dashboard, nó `5:92`.
 *
 * O badge de sequência some quando a sequência é zero: um "0 dias" em
 * destaque cobra em vez de informar, e quem acabou de criar a conta veria
 * isso na primeira tela.
 */
export function DashboardHeader({ user, streakDays, onProfile }: DashboardHeaderProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;
  const diaOuDias = streakDays === 1 ? 'dia' : 'dias';

  return (
    <View style={styles.header}>
      <View style={styles.identidade}>
        <Pressable
          onPress={onProfile}
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <Avatar initials={user.initials} name={user.name} />
        </Pressable>
        <View style={styles.nomes}>
          <Text style={[styles.saudacao, isDark && styles.subtituloEscuro]}>Bem-vindo!</Text>
          <Text style={[styles.nome, { color: palette.primaryDark }]} numberOfLines={1}>
            {user.name}
          </Text>
        </View>
      </View>

      {streakDays > 0 ? (
        <View
          style={[styles.badge, isDark && styles.badgeEscuro]}
          accessible
          accessibilityLabel={`Sequência de ${streakDays} ${diaOuDias} estudando`}
        >
          <FlameIcon size={LADO_DO_ICONE} color={colors.rose} />
          <Text style={[styles.badgeTexto, isDark && styles.textoClaro]}>{`${streakDays} ${diaOuDias}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  identidade: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.md,
  },
  nomes: {
    flexShrink: 1,
    gap: 2,
  },
  saudacao: {
    ...typography.caption,
    color: colors.textMuted,
  },
  nome: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.outfitBold,
    fontSize: 20,
    lineHeight: 28,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeTexto: {
    ...typography.badgeStrong,
    color: colors.rose,
  },
  pressed: {
    opacity: 0.7,
  },
  badgeEscuro: {
    backgroundColor: '#4c1d32',
  },
  textoClaro: {
    color: '#f8fafc',
  },
  subtituloEscuro: {
    color: '#cbd5e1',
  },
});
