import { StyleSheet, Text, View } from "react-native";

import { ClockIcon, Trash2Icon } from "@/components/icons";
import {
  Banner,
  Button,
  DateField,
  ScreenContainer,
  TextField,
} from "@/components/ui";
import { useAvailabilityController } from "@/controllers/availability/AvailabilityController";
import { colors, darkColors, spacing, typography } from "@/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { ErrorState } from "@/views/_templates/_errorState";
import { ScreenTopBar } from "@/views/_templates/_screenTopBar";
import { SkeletonBlock } from "@/views/_templates/_skeletonBlock";

function dataLegivel(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export default function AvailabilityExceptions() {
  const controller = useAvailabilityController();
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  if (controller.status === "error") {
    return (
      <ScreenContainer>
        <ScreenTopBar title="Exceções" onBack={controller.goBack} />
        <ErrorState
          message={
            controller.errorMessage ?? "Não foi possível carregar as exceções."
          }
          onRetry={controller.reload}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTopBar title="Exceções" onBack={controller.goBack}>
        <Text style={[styles.explicacao, { color: palette.textMuted }]}>
          Substitua o tempo habitual em uma data específica, sem alterar sua
          disponibilidade semanal.
        </Text>
      </ScreenTopBar>

      {controller.status === "loading" ? (
        <View style={styles.lista}>
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
          <SkeletonBlock height={64} />
        </View>
      ) : (
        <View style={styles.lista}>
          <DateField
            label="Data"
            value={controller.exceptionDate}
            onChangeText={controller.setExceptionDate}
            editable={!controller.exceptionSaving}
          />
          <TextField
            label="Minutos disponíveis"
            icon={ClockIcon}
            placeholder="0"
            value={controller.exceptionMinutes}
            onChangeText={controller.setExceptionMinutes}
            keyboardType="number-pad"
            maxLength={4}
            editable={!controller.exceptionSaving}
          />
          <TextField
            label="Motivo (opcional)"
            icon={ClockIcon}
            placeholder="Ex.: tenho aula o dia todo"
            value={controller.exceptionReason}
            onChangeText={controller.setExceptionReason}
            maxLength={200}
            editable={!controller.exceptionSaving}
          />
          <Button
            label="Salvar exceção"
            variant="secondary"
            onPress={controller.saveException}
            loading={controller.exceptionSaving}
          />

          {controller.errorMessage === null ? null : (
            <Text
              style={styles.erro}
              accessibilityLiveRegion="polite"
              role="alert"
            >
              {controller.errorMessage}
            </Text>
          )}

          {controller.saved && controller.conflicts.length === 0 ? (
            <Banner tone="info" message="Exceção salva e calendário refeito." />
          ) : null}

          {controller.conflicts.map((conflict) => (
            <Banner
              key={`${conflict.kind}-${conflict.assessmentId}`}
              tone="warning"
              message={conflict.message}
            />
          ))}

          <Text style={[styles.secaoTitulo, { color: palette.ink }]}>Datas configuradas</Text>
          {controller.exceptions.map((exception) => (
            <View key={exception.date} style={styles.excecao}>
              <View style={styles.excecaoTexto}>
                <Text style={[styles.excecaoData, { color: palette.ink }]}>
                  {dataLegivel(exception.date)}
                </Text>
                <Text style={[styles.apoio, { color: palette.textMuted }]}>
                  {exception.minutes} min
                  {exception.reason === null ? "" : ` · ${exception.reason}`}
                </Text>
              </View>
              <Button
                icon={Trash2Icon}
                accessibilityLabel="Remover exceção"
                variant="secondary"
                onPress={() => controller.removeException(exception.date)}
                disabled={controller.exceptionSaving}
              />
            </View>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  explicacao: {
    ...typography.screenSubtitle,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  lista: {
    gap: spacing.lg,
  },
  secaoTitulo: {
    ...typography.sectionTitle,
    marginTop: spacing.md,
  },
  erro: {
    ...typography.caption,
    color: colors.danger,
  },
  excecao: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  excecaoTexto: {
    flex: 1,
    gap: 2,
  },
  excecaoData: {
    ...typography.itemTitle,
  },
  apoio: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
