import type { SessionItem as Session } from '@study-flow/shared';
import type { FC } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BookOpenIcon,
  CheckIcon,
  DropletIcon,
  FlameIcon,
  GlobeIcon,
  MapIcon,
  ZapIcon,
  type IconProps,
} from '@/components/icons';
import { Card } from '@/components/ui';
import { colors, darkColors, radii, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/utils/color';

type SessionItemProps = {
  readonly session: Session;
};

const LADO_DO_BLOCO = 44;
const LADO_DO_ICONE = 20;
const OPACIDADE_DO_BLOCO = 0.1;

/**
 * Ícones possíveis para o quadrado da matéria.
 *
 * A matéria tem nome e cor, e não ícone: o modelo não guarda um. Em vez de
 * repetir o mesmo desenho em toda a lista, o ícone é escolhido pelo nome da
 * matéria, sempre o mesmo para o mesmo nome. É decoração derivada do dado
 * que existe, como a cor, e não um campo inventado.
 */
const ICONES: readonly FC<IconProps>[] = [
  ZapIcon,
  BookOpenIcon,
  DropletIcon,
  GlobeIcon,
  MapIcon,
  FlameIcon,
];

function iconeDaMateria(nome: string): FC<IconProps> {
  let soma = 0;
  for (let i = 0; i < nome.length; i += 1) {
    soma = (soma + nome.charCodeAt(i)) % 1021;
  }
  return ICONES[soma % ICONES.length] ?? BookOpenIcon;
}

/**
 * A segunda linha do canto direito, que depende do estado da sessão.
 *
 * Para uma sessão planejada o que importa é quanto tempo falta para a
 * avaliação. Depois que ela começa ou termina, o estado passa a ser a
 * informação mais útil, e o prazo continua visível nas outras sessões da
 * mesma avaliação. Sem isso, concluída e pendente ficam idênticas na tela.
 */
function legendaDoEstado(session: Session): string {
  if (session.status === 'DONE') return 'Concluída';
  if (session.status === 'IN_PROGRESS') return 'Em andamento';

  return prazoLegivel(session.assessmentType, session.daysUntilDue);
}

/** "Prova em 3 dias", "Trabalho hoje", "Prova atrasada". */
export function prazoLegivel(tipo: Session['assessmentType'], dias: number): string {
  const nome = tipo === 'EXAM' ? 'Prova' : 'Trabalho';

  if (dias < 0) return tipo === 'EXAM' ? 'Prova atrasada' : 'Trabalho atrasado';
  if (dias === 0) return `${nome} hoje`;
  if (dias === 1) return `${nome} amanhã`;
  return `${nome} em ${dias} dias`;
}

/**
 * Um item da lista de sessões, do nó `5:122`.
 *
 * O mesmo desenho serve ao dashboard e à agenda do calendário, por isso ele
 * é template compartilhado e não uma peça de cada tela.
 *
 * O Figma mostra um horário ("11:30 AM") no canto direito. `StudyActivity`
 * guarda a data e a ordem do dia, de propósito sem hora: o plano distribui
 * dias, não agenda relógio. No lugar do horário entram dois dados que
 * existem — a duração estimada e o prazo da avaliação — na mesma caixa, com
 * a mesma tipografia e o mesmo alinhamento.
 */
export function SessionItem({ session }: SessionItemProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;
  const concluida = session.status === 'DONE';
  const emAndamento = session.status === 'IN_PROGRESS';

  const Icone = concluida ? CheckIcon : iconeDaMateria(session.subject.name);
  const cor = session.subject.color ?? colors.primary;
  const fundo = withOpacity(session.subject.color, OPACIDADE_DO_BLOCO) ?? colors.primaryGlow;

  return (
    <Card style={styles.item}>
      <View style={[styles.bloco, { backgroundColor: fundo }]}>
        <Icone size={LADO_DO_ICONE} color={cor} />
      </View>

      <View style={styles.texto}>
        <Text
          style={[
            styles.titulo,
            { color: palette.ink },
            concluida && { color: palette.textMuted },
          ]}
          numberOfLines={1}
        >
          {session.title}
        </Text>
        <Text style={[styles.subtitulo, { color: palette.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
          {`${session.subject.name} · ${session.assessmentTitle}`}
        </Text>
      </View>

      <View style={styles.badge}>
        <Text style={[styles.duracao, { color: isDark ? '#a5b4fc' : colors.primary }, concluida && { color: palette.textMuted }]}>
          {`${session.estimatedMinutes} min`}
        </Text>
        <Text style={[styles.prazo, { color: palette.textSubtle }, emAndamento && { color: isDark ? '#a5b4fc' : colors.primary }]}>
          {legendaDoEstado(session)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  bloco: {
    alignItems: 'center',
    borderRadius: radii.control,
    height: LADO_DO_BLOCO,
    justifyContent: 'center',
    width: LADO_DO_BLOCO,
  },
  texto: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    ...typography.itemTitle,
  },
  // Riscar o título é o que diferencia "já fiz" de "ainda vou fazer" sem
  // precisar de mais uma linha de texto na mesma altura de 44.
  tituloConcluido: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  subtitulo: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badge: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  duracao: {
    ...typography.badgeStrong,
  },
  duracaoConcluida: {
    color: colors.textMuted,
  },
  prazo: {
    ...typography.badgeSoft,
  },
  // Índigo é a cor do que está ativo no resto do app: a aba selecionada e o
  // dia escolhido no calendário. A sessão em andamento usa a mesma.
  prazoEmAndamento: {
    color: colors.primary,
  },
});
