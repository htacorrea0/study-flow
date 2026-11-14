import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertTriangleIcon, GeminiIcon, RotateCcwIcon, XIcon } from '@/components/icons';
import { ConfirmDialog } from '@/components/ui';
import {
  QUICK_PROMPTS,
  type StudyAssistantController,
} from '@/controllers/studyAssistant/StudyAssistantController';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { colors, darkColors, radii, sizes, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

import { Composer } from './_composer';
import { DeadlinePromptDialog } from './_deadlinePrompt';
import { MessageBubble } from './_messageBubble';
import { StudyPlanCard } from './_studyPlanCard';

type StudyAssistantProps = {
  readonly controller: StudyAssistantController;
  readonly onClose: () => void;
};

/**
 * Chat em tela cheia com o assistente de plano de estudos (Gemini).
 *
 * Recebe o controller pronto, em vez de criá-lo, porque quem monta esta tela
 * é um Modal que desmonta o conteúdo ao fechar: o estado precisa morar acima
 * dele para a conversa sobreviver a um fechar-e-abrir.
 */
export default function StudyAssistant({ controller, onClose }: StudyAssistantProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;
  const insets = useSafeAreaInsets();
  const rolagem = useRef<ScrollViewInstance>(null);
  const tela = useRef<ViewInstance>(null);
  const c = controller;

  // Quanto o teclado cobre da tela: o rodapé sobe exatamente isso.
  const teclado = useKeyboardOverlap(tela);
  const tecladoAberto = teclado > 0;

  // Desce até a última mensagem quando a conversa cresce ou o teclado abre.
  useEffect(() => {
    const id = setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [c.messages.length, c.sending, teclado]);

  const vazia = c.messages.length === 0;

  return (
    <View
      ref={tela}
      style={[styles.tela, { backgroundColor: palette.canvas, paddingTop: insets.top, paddingBottom: teclado }]}
    >
      {/* Cabeçalho */}
      <View style={[styles.cabecalho, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
        <View style={styles.marca}>
          <GeminiIcon size={26} />
          <View>
            <Text style={[styles.titulo, { color: palette.ink }]}>Assistente de estudos</Text>
            <Text style={[styles.subtitulo, { color: palette.textMuted }]}>com Gemini</Text>
          </View>
        </View>
        <View style={styles.acoesTopo}>
          {vazia ? null : (
            <Pressable
              onPress={c.reset}
              disabled={c.sending}
              style={styles.botaoTopo}
              accessibilityRole="button"
              accessibilityLabel="Nova conversa"
            >
              <RotateCcwIcon size={20} color={palette.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            style={styles.botaoTopo}
            accessibilityRole="button"
            accessibilityLabel="Fechar assistente"
          >
            <XIcon size={22} color={palette.ink} />
          </Pressable>
        </View>
      </View>

      {/* Conversa */}
      <ScrollView
        ref={rolagem}
        style={styles.flex}
        contentContainerStyle={styles.conversa}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {vazia ? (
          <View style={styles.boasVindas}>
            <View style={[styles.boasVindasIcone, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <GeminiIcon size={40} />
            </View>
            <Text style={[styles.boasVindasTitulo, { color: palette.ink }]}>Vamos montar seu plano de estudos?</Text>
            <Text style={[styles.boasVindasTexto, { color: palette.textMuted }]}>
              Toque no clipe 📎 e envie o seu plano de aulas (PDF, foto ou texto). Eu leio as
              matérias, os conteúdos e as datas de prova e monto uma rotina semanal com o tempo
              certo para cada matéria, respeitando a disponibilidade que você cadastrou no app.
            </Text>
            <View style={styles.sugestoes}>
              {QUICK_PROMPTS.map((sugestao) => (
                <Pressable
                  key={sugestao}
                  onPress={() => c.send(sugestao)}
                  disabled={c.sending}
                  style={({ pressed }) => [
                    styles.sugestao,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                    pressed ? styles.pressionado : null,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.sugestaoTexto, { color: palette.primaryDark }]}>{sugestao}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {c.messages.map((item) => (
          <View key={item.id} style={styles.item}>
            <MessageBubble item={item} />
            {item.studyPlan ? (
              <StudyPlanCard
                plan={item.studyPlan}
                saveState={c.saveState?.messageId === item.id ? c.saveState : null}
                onApply={() => item.studyPlan && c.applyPlan(item.id, item.studyPlan)}
              />
            ) : null}
          </View>
        ))}

        {c.sending ? (
          <View style={styles.digitando}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.digitandoTexto, { color: palette.textMuted }]}>
              O Gemini está analisando… se os servidores estiverem cheios, pode levar até 2 minutos.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {c.errorMessage ? (
        <Pressable
          onPress={c.dismissError}
          style={styles.erro}
          accessibilityRole="alert"
          accessibilityHint="Toque para dispensar"
        >
          <AlertTriangleIcon size={18} color={colors.danger} />
          <Text style={styles.erroTexto}>{c.errorMessage}</Text>
        </Pressable>
      ) : null}

      {/* Com o teclado aberto ele já ocupa a área da barra de gestos do
          sistema; a folga de baixo só é necessária com ele fechado. */}
      <View
        style={{
          paddingBottom: tecladoAberto ? spacing.sm : Math.max(insets.bottom, spacing.md),
          backgroundColor: palette.surface,
        }}
      >
        <Composer
          draft={c.draft}
          pendingFile={c.pendingFile}
          sending={c.sending}
          canSend={c.canSend}
          onChangeDraft={c.setDraft}
          onPickFile={c.pickFile}
          onRemoveFile={c.removeFile}
          onSend={() => c.send()}
        />
      </View>

      {c.deadlinePrompt ? (
        <DeadlinePromptDialog
          prompt={c.deadlinePrompt}
          onConfirm={c.confirmDeadlines}
          onCancel={c.cancelDeadlines}
        />
      ) : null}

      <ConfirmDialog
        visible={c.availabilityPrompt !== null}
        title="Usar a rotina do plano?"
        message={
          'Seus dias estão todos com zero minuto, então o calendário não tem onde encaixar as sessões. ' +
          'Posso preencher sua disponibilidade com os minutos por dia que a IA sugeriu. Você muda isso ' +
          'quando quiser em Matérias › Disponibilidade.'
        }
        confirmLabel="Preencher disponibilidade"
        cancelLabel="Agora não"
        confirming={c.savingAvailability}
        onConfirm={c.confirmAvailability}
        onCancel={c.dismissAvailability}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  tela: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titulo: {
    ...typography.itemTitle,
    fontSize: 17,
  },
  subtitulo: {
    ...typography.caption,
  },
  acoesTopo: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  botaoTopo: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversa: {
    padding: spacing.lg,
    gap: spacing.lg,
    flexGrow: 1,
  },
  item: {
    gap: spacing.md,
  },
  boasVindas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  boasVindasIcone: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boasVindasTitulo: {
    ...typography.sectionTitle,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
  },
  boasVindasTexto: {
    ...typography.footerText,
    textAlign: 'center',
  },
  sugestoes: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sugestao: {
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sugestaoTexto: {
    ...typography.label,
  },
  pressionado: {
    opacity: 0.7,
  },
  digitando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 36,
  },
  digitandoTexto: {
    ...typography.caption,
    flex: 1,
  },
  erro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.roseSoft,
  },
  erroTexto: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
});
