import type { ActivityStatus, StudyResourceItem } from '@study-flow/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';

import {
  BookOpenIcon,
  GlobeIcon,
  PencilIcon,
  PlayIcon,
  type IconProps,
} from '@/components/icons';
import { Banner, Button, Card, ScreenContainer } from '@/components/ui';
import { useSessionDetailController } from '@/controllers/session/SessionDetailController';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { withOpacity } from '@/utils/color';
import { dayLabel } from '@/utils/date';
import { ErrorState } from '@/views/_templates/_errorState';
import { ScreenTopBar } from '@/views/_templates/_screenTopBar';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { prazoLegivel } from '@/views/_templates/_sessionItem';

const LADO_DO_BLOCO = 36;
const LADO_DO_ICONE = 18;
const OPACIDADE_DO_BLOCO = 0.1;

const ICONE_DO_TIPO: Record<StudyResourceItem['type'], ComponentType<IconProps>> = {
  VIDEO: PlayIcon,
  ARTICLE: BookOpenIcon,
  EXERCISE_LIST: PencilIcon,
  COURSE: GlobeIcon,
  OTHER: GlobeIcon,
};

const ETIQUETA_DO_STATUS: Partial<Record<ActivityStatus, string>> = {
  DONE: 'Estudado',
  SKIPPED: 'Não estudado',
};

const NOME_DO_TIPO: Record<StudyResourceItem['type'], string> = {
  VIDEO: 'Vídeo',
  ARTICLE: 'Leitura',
  EXERCISE_LIST: 'Exercícios',
  COURSE: 'Curso',
  OTHER: 'Material',
};

/**
 * Detalhe de uma sessão de estudo.
 *
 * Três coisas, nesta ordem: o que estudar hoje, por onde estudar e o registro
 * do que aconteceu. Os links mudam a cada passada do mesmo conteúdo, que é o
 * que diferencia revisar de reler a mesma página três dias seguidos.
 */
export default function SessionDetail() {
  const controller = useSessionDetailController();
  const { data } = controller;

  if (controller.status === 'error' && data === null) {
    return (
      <ScreenContainer edgeToEdge>
        <View style={styles.topo}>
          <ScreenTopBar title="Sessão" onBack={controller.goBack} />
        </View>
        <ErrorState
          message={controller.errorMessage ?? 'Não foi possível abrir esta sessão.'}
          onRetry={controller.reload}
        />
      </ScreenContainer>
    );
  }

  if (data === null) {
    return (
      <ScreenContainer edgeToEdge>
        <View style={styles.topo}>
          <ScreenTopBar title="Sessão" onBack={controller.goBack} />
        </View>
        <View style={styles.corpo}>
          <SkeletonBlock height={140} radius={radii.cardLarge} />
          <SkeletonBlock height={76} radius={radii.card} />
          <SkeletonBlock height={76} radius={radii.card} />
        </View>
      </ScreenContainer>
    );
  }

  const { session } = data;
  const etiquetaDoStatus = ETIQUETA_DO_STATUS[session.status];
  const cor = session.subject.color ?? colors.primary;
  const fundo = withOpacity(session.subject.color, OPACIDADE_DO_BLOCO) ?? colors.primaryGlow;

  return (
    <ScreenContainer edgeToEdge>
      <View style={styles.topo}>
        <ScreenTopBar title="Sessão de estudo" onBack={controller.goBack} />
      </View>

      <ScrollView contentContainerStyle={styles.corpo}>
        <Card size="large" style={styles.resumo}>
          <Text style={styles.titulo}>{session.title}</Text>
          <Text style={styles.subtitulo}>
            {`${session.subject.name} · ${session.assessmentTitle}`}
          </Text>

          <View style={styles.etiquetas}>
            <Etiqueta texto={`${session.estimatedMinutes} min`} cor={cor} fundo={fundo} />
            <Etiqueta texto={session.passLabel} cor={cor} fundo={fundo} />
            <Etiqueta
              texto={prazoLegivel(session.assessmentType, session.daysUntilDue)}
              cor={cor}
              fundo={fundo}
            />
            {etiquetaDoStatus === undefined ? null : (
              <Etiqueta texto={etiquetaDoStatus} cor={cor} fundo={fundo} />
            )}
          </View>

          <Text style={styles.data}>{`Marcada para ${dayLabel(session.scheduledDate)}`}</Text>

          {controller.canTime ? (
            <Button label="Cronometrar esta sessão" variant="secondary" onPress={controller.openTimer} />
          ) : null}
        </Card>

        {controller.errorMessage === null ? null : (
          <Banner tone="warning" message={controller.errorMessage} />
        )}

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Por onde estudar</Text>

          {data.suggestionsUnavailable ? (
            <Text style={styles.vazio}>
              As sugestões de material dependem da chave de busca na configuração da API. Veja
              apps/api/.env.example.
            </Text>
          ) : data.suggestions.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhum material encontrado para este conteúdo. Tente de novo mais tarde.
            </Text>
          ) : (
            data.suggestions.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                onPress={() => controller.openResource(resource)}
              />
            ))
          )}
        </View>

        {controller.canConfirm ? (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Você estudou isto?</Text>

            {session.status === 'DONE' ? (
              <Banner message='Marcado como estudado. Toque em "não estudei" para corrigir.' />
            ) : session.status === 'SKIPPED' ? (
              <Banner
                tone="warning"
                message="Marcado como não estudado. Este conteúdo foi remarcado para os dias que faltam."
              />
            ) : (
              <Text style={styles.vazio}>
                Dia que passa sem resposta conta como estudado. Marque "não estudei" para o app
                remarcar este conteúdo nos dias que faltam.
              </Text>
            )}

            <Button
              label="Estudei este conteúdo"
              onPress={() => controller.setStudied(true)}
              loading={controller.submitting}
            />
            <Button
              label="Não estudei"
              variant="secondary"
              onPress={() => controller.setStudied(false)}
              disabled={controller.submitting}
            />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

type EtiquetaProps = {
  readonly texto: string;
  readonly cor: string;
  readonly fundo: string;
};

function Etiqueta({ texto, cor, fundo }: EtiquetaProps) {
  return (
    <View style={[styles.etiqueta, { backgroundColor: fundo }]}>
      <Text style={[styles.etiquetaTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

type ResourceRowProps = {
  readonly resource: StudyResourceItem;
  readonly onPress: () => void;
};

function ResourceRow({ resource, onPress }: ResourceRowProps) {
  const Icone = ICONE_DO_TIPO[resource.type];

  return (
    <Card style={styles.link} onPress={onPress} accessibilityLabel={`Abrir ${resource.title}`}>
      <View style={styles.linkBloco}>
        <Icone size={LADO_DO_ICONE} color={colors.primary} />
      </View>

      <View style={styles.linkTexto}>
        <Text style={styles.linkTitulo} numberOfLines={2}>
          {resource.title}
        </Text>
        <Text style={styles.linkLegenda} numberOfLines={1}>
          {resource.source === null
            ? NOME_DO_TIPO[resource.type]
            : `${NOME_DO_TIPO[resource.type]} · ${resource.source}`}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topo: {
    paddingHorizontal: sizes.pagePadding,
    paddingTop: sizes.pagePadding,
  },
  corpo: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  resumo: {
    gap: spacing.sm,
  },
  titulo: {
    ...typography.cardTitle,
  },
  subtitulo: {
    ...typography.caption,
    color: colors.textMuted,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  etiqueta: {
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  etiquetaTexto: {
    ...typography.badgeStrong,
  },
  data: {
    ...typography.caption,
    color: colors.textMuted,
  },
  secao: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  secaoTitulo: {
    ...typography.sectionTitle,
  },
  vazio: {
    ...typography.screenSubtitle,
  },
  link: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  linkBloco: {
    alignItems: 'center',
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.control,
    height: LADO_DO_BLOCO,
    justifyContent: 'center',
    width: LADO_DO_BLOCO,
  },
  linkTexto: {
    flex: 1,
    gap: 2,
  },
  linkTitulo: {
    ...typography.itemTitle,
  },
  linkLegenda: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
