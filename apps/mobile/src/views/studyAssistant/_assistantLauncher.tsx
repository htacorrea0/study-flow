import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeminiIcon } from '@/components/icons';
import { useStudyAssistantController } from '@/controllers/studyAssistant/StudyAssistantController';
import { colors, spacing } from '@/theme';

import StudyAssistant from './studyAssistant';

/** Altura da barra de abas (BottomTabBar). O botão flutua logo acima dela. */
const ALTURA_DA_BARRA = 72;
const LADO_DO_BOTAO = 58;

/**
 * Botão flutuante do Gemini + o chat em tela cheia.
 *
 * Montado uma vez no layout do grupo `(app)`, por cima das abas: aparece em
 * todas as telas logadas e nunca na de login. O controller vive aqui, e não
 * dentro do chat, para a conversa continuar lá quando a pessoa fecha e abre.
 */
export function AssistantLauncher() {
  const insets = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const controller = useStudyAssistantController();

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.ancora, { bottom: ALTURA_DA_BARRA + insets.bottom + spacing.lg }]}
      >
        <Pressable
          onPress={() => setAberto(true)}
          style={({ pressed }) => [styles.botao, pressed ? styles.pressionado : null]}
          accessibilityRole="button"
          accessibilityLabel="Abrir assistente de estudos com Gemini"
        >
          <GeminiIcon size={30} />
        </Pressable>
      </View>

      <Modal
        visible={aberto}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAberto(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <StudyAssistant controller={controller} onClose={() => setAberto(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  ancora: {
    position: 'absolute',
    right: spacing.xl,
  },
  botao: {
    width: LADO_DO_BOTAO,
    height: LADO_DO_BOTAO,
    borderRadius: LADO_DO_BOTAO / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    // Sombra no iOS/web e elevação no Android.
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pressionado: {
    transform: [{ scale: 0.94 }],
  },
});
