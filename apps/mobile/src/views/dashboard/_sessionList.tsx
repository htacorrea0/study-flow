import type { SessionItem as Session } from '@study-flow/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { SessionItem } from '@/views/_templates/_sessionItem';

type SessionListProps = {
  readonly sessions: readonly Session[];
  readonly onSeeAll: () => void;
};

/**
 * "Próximas sessões" e a lista abaixo, nós `5:119` e `5:122`.
 *
 * Sem sessão nenhuma, o lugar da lista recebe um texto explicando o porquê.
 * O convite é cadastrar matérias, que é o que de fato destrava o plano, e
 * não um botão para uma tela que ainda não faz isso.
 */
export function SessionList({ sessions, onSeeAll }: SessionListProps) {
  const { isDark } = useTheme();

  return (
    <View>
      <View style={styles.cabecalho}>
        <Text style={[styles.titulo, isDark && styles.textoClaro]}>Próximas sessões</Text>
        <Pressable onPress={onSeeAll} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.verTodas}>Ver todas</Text>
        </Pressable>
      </View>

      <View style={styles.lista}>
        {sessions.length === 0 ? (
          <Text style={[styles.vazio, isDark && styles.subtituloEscuro]}>
            Nenhuma sessão planejada ainda. Cadastre suas matérias e as avaliações de cada
            uma para o Study Flow montar seu plano.
          </Text>
        ) : (
          sessions.map((session) => <SessionItem key={session.activityId} session={session} />)
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  titulo: {
    ...typography.sectionTitle,
  },
  verTodas: {
    color: colors.primary,
    fontFamily: fontFamilies.manropeSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  lista: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  vazio: {
    ...typography.screenSubtitle,
    paddingHorizontal: spacing.xs,
  },
  textoClaro: {
    color: '#f8fafc',
  },
  subtituloEscuro: {
    color: '#cbd5e1',
  },
});
