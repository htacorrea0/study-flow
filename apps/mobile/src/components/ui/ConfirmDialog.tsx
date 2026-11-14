import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

import { Button } from './Button';

type ConfirmDialogProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  /** Rótulo do botão que confirma. Diga o que vai acontecer: "Apagar". */
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** `true` pinta o botão de confirmar em vermelho. */
  readonly destructive?: boolean;
  readonly confirming?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

/**
 * Diálogo de confirmação.
 *
 * Usa o `Modal` do React Native, e não o `Alert`: o `Alert` não existe no
 * React Native Web, e a verificação do fluxo acontece no navegador. Um
 * diálogo que some justo onde ele é testado não serve.
 *
 * O fundo escurecido também fecha no toque do sistema (`onRequestClose`
 * cobre o botão voltar do Android), porque desistir precisa ser tão fácil
 * quanto confirmar.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.fundo}>
        <View style={[styles.caixa, isDark && styles.caixaEscura]} accessibilityRole="alert">
          <Text style={[styles.titulo, isDark && styles.textoClaro]}>{title}</Text>
          <Text style={[styles.mensagem, isDark && styles.subtituloEscuro]}>{message}</Text>

          <View style={styles.acoes}>
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
              loading={confirming}
            />
            <Button
              label={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              disabled={confirming}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  caixa: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.xxl,
    width: '100%',
  },
  titulo: {
    // `cardTitle` é branco, do cartão índigo da meta. O diálogo é claro.
    ...typography.sectionTitle,
  },
  mensagem: {
    ...typography.screenSubtitle,
  },
  acoes: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  caixaEscura: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
  },
  textoClaro: {
    color: '#f8fafc',
  },
  subtituloEscuro: {
    color: '#cbd5e1',
  },
});
