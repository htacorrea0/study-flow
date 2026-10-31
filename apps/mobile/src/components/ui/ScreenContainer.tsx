import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes } from '@/theme';

type ScreenContainerProps = {
  children: ReactNode;
  /** Conteúdo fixado no rodapé, fora da rolagem. Ex.: o link de troca de tela. */
  footer?: ReactNode;
};

/**
 * Moldura comum a todas as telas.
 *
 * No Figma cada tela é um frame de 402 × 874 com uma `status-bar` e uma
 * `home-indicator-area` desenhadas à mão. Essas duas camadas são simulação do
 * chrome do iOS e não viram código: quem reserva esse espaço aqui é o
 * `useSafeAreaInsets`, que acerta em qualquer aparelho — inclusive nos
 * Android sem entalhe, onde um valor fixo de 44 deixaria uma faixa vazia.
 *
 * O que é código: fundo `canvas`, padding de 24 e o conteúdo rolável acima de
 * um rodapé fixo, exatamente a composição do nó `5:36`.
 */
export function ScreenContainer({ children, footer }: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      // No iOS o teclado sobrepõe a tela e o padding resolve; no Android o
      // sistema já redimensiona a janela, e repetir o ajuste encolheria o
      // conteúdo duas vezes.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          // Sem isto, o primeiro toque com o teclado aberto só o fecha: o
          // botão de enviar exigiria dois toques.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer === undefined ? null : (
          <View style={[styles.footer, { paddingBottom: insets.bottom + sizes.pagePadding }]}>
            {footer}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: sizes.pagePadding,
    paddingTop: sizes.pagePadding,
    paddingBottom: sizes.pagePadding,
  },
  footer: {
    paddingHorizontal: sizes.pagePadding,
    paddingTop: sizes.pagePadding,
  },
});
