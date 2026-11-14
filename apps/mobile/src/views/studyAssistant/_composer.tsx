import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FileTextIcon, PaperclipIcon, SendIcon, XIcon } from '@/components/icons';
import type { PickedFile } from '@/services/ai/AiStudyPlanService';
import { colors, darkColors, radii, sizes, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type ComposerProps = {
  readonly draft: string;
  readonly pendingFile: PickedFile | null;
  readonly sending: boolean;
  readonly canSend: boolean;
  readonly onChangeDraft: (text: string) => void;
  readonly onPickFile: () => void;
  readonly onRemoveFile: () => void;
  readonly onSend: () => void;
};

function tamanho(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Rodapé do chat: arquivo pendente, clipe, campo de texto e enviar.
 *
 * O arquivo escolhido aparece como chip acima do campo até ser enviado, para
 * a pessoa poder escrever uma instrução junto ("tenho mais dificuldade em
 * Cálculo") antes de mandar.
 */
export function Composer({
  draft,
  pendingFile,
  sending,
  canSend,
  onChangeDraft,
  onPickFile,
  onRemoveFile,
  onSend,
}: ComposerProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={[styles.rodape, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
      {pendingFile ? (
        <View style={[styles.chip, { backgroundColor: palette.primaryGlow }]}>
          <FileTextIcon size={18} color={isDark ? palette.primaryDark : colors.primary} />
          <View style={styles.chipTextos}>
            <Text style={[styles.chipNome, { color: palette.ink }]} numberOfLines={1}>
              {pendingFile.name}
            </Text>
            <Text style={[styles.chipTamanho, { color: palette.textMuted }]}>{tamanho(pendingFile.size)}</Text>
          </View>
          <Pressable
            onPress={onRemoveFile}
            disabled={sending}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remover arquivo"
          >
            <XIcon size={18} color={palette.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.linha}>
        <Pressable
          onPress={onPickFile}
          disabled={sending}
          style={({ pressed }) => [
            styles.botaoIcone,
            { backgroundColor: palette.primaryGlow },
            pressed ? styles.pressionado : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Anexar plano de aulas"
        >
          <PaperclipIcon size={20} color={isDark ? palette.primaryDark : colors.primary} />
        </Pressable>

        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={pendingFile ? 'Adicione uma observação (opcional)' : 'Pergunte ou envie seu plano de aulas'}
          placeholderTextColor={palette.textSubtle}
          style={[styles.campo, { backgroundColor: palette.canvas, borderColor: palette.border, color: palette.ink }]}
          multiline
          maxLength={4000}
          editable={!sending}
          accessibilityLabel="Mensagem para o assistente"
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.botaoEnviar,
            !canSend ? styles.desabilitado : null,
            pressed && canSend ? styles.pressionado : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !canSend, busy: sending }}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <SendIcon size={18} color={colors.white} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rodape: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipTextos: {
    flex: 1,
  },
  chipNome: {
    ...typography.label,
  },
  chipTamanho: {
    ...typography.caption,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  botaoIcone: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    borderRadius: sizes.minTouchTarget / 2,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campo: {
    ...typography.input,
    flex: 1,
    minHeight: sizes.minTouchTarget,
    maxHeight: 120,
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
  },
  botaoEnviar: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    borderRadius: sizes.minTouchTarget / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desabilitado: {
    opacity: 0.4,
  },
  pressionado: {
    opacity: 0.8,
  },
});
