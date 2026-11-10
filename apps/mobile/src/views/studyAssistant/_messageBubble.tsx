import { StyleSheet, Text, View } from 'react-native';

import { FileTextIcon, GeminiIcon } from '@/components/icons';
import type { ChatItem } from '@/controllers/studyAssistant/StudyAssistantController';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme';

import { RichText } from './_richText';

type MessageBubbleProps = {
  readonly item: ChatItem;
};

/**
 * Balão de uma mensagem.
 *
 * Pessoa: índigo à direita. Assistente: branco com borda à esquerda, com o
 * brilho do Gemini ao lado para deixar claro quem está falando.
 */
export function MessageBubble({ item }: MessageBubbleProps) {
  const daPessoa = item.role === 'user';

  return (
    <View style={[styles.linha, daPessoa ? styles.linhaPessoa : styles.linhaModelo]}>
      {daPessoa ? null : (
        <View style={styles.avatar}>
          <GeminiIcon size={16} />
        </View>
      )}

      <View style={[styles.balao, daPessoa ? styles.balaoPessoa : styles.balaoModelo]}>
        {item.attachmentName ? (
          <View style={[styles.anexo, daPessoa ? styles.anexoPessoa : null]}>
            <FileTextIcon size={16} color={daPessoa ? colors.white : colors.primary} />
            <Text
              style={[styles.anexoNome, daPessoa ? styles.textoPessoa : null]}
              numberOfLines={1}
            >
              {item.attachmentName}
            </Text>
          </View>
        ) : null}

        {item.text.length > 0 ? (
          <RichText
            text={item.text}
            style={[styles.texto, daPessoa ? styles.textoPessoa : null]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  linhaPessoa: {
    justifyContent: 'flex-end',
    paddingLeft: spacing.xxl * 2,
  },
  linhaModelo: {
    justifyContent: 'flex-start',
    paddingRight: spacing.xxl,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balao: {
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    flexShrink: 1,
  },
  balaoPessoa: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  balaoModelo: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderBottomLeftRadius: spacing.xs,
  },
  texto: {
    ...typography.input,
  },
  textoPessoa: {
    color: colors.white,
  },
  anexo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.control - 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  anexoPessoa: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  anexoNome: {
    fontFamily: fontFamilies.manropeSemiBold,
    fontSize: 13,
    color: colors.ink,
    flexShrink: 1,
  },
});
