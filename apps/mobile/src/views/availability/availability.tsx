import type { Weekday } from "@study-flow/shared";
import { StyleSheet, Text, View } from "react-native";

import { CalendarIcon, ClockIcon } from "@/components/icons";
import {
  Banner,
  Button,
  ListRow,
  ScreenContainer,
  TextField,
} from "@/components/ui";
import { useAvailabilityController } from "@/controllers/availability/AvailabilityController";
import { colors, darkColors, spacing, typography } from "@/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { ErrorState } from "@/views/_templates/_errorState";
import { ScreenTopBar } from "@/views/_templates/_screenTopBar";
import { SkeletonBlock } from "@/views/_templates/_skeletonBlock";

const NOME_DO_DIA: Record<Weekday, string> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terça-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

function totalLegivel(minutes: number): string {
  const horas = Math.floor(minutes / 60);
  const resto = minutes % 60;

  if (horas === 0) {
    return `${resto} min por semana`;
  }

  return resto === 0
    ? `${horas} h por semana`
    : `${horas} h ${resto} min por semana`;
}

/**
 * Minutos disponíveis em cada dia da semana.
 *
 * É o chão de todo o plano: dia com zero minuto não recebe sessão nenhuma. A
 * semana é salva inteira de uma vez, e salvar refaz a distribuição de todas
 * as avaliações, porque mudar o tempo livre muda o que cabe em cada dia.
 */
export default function Availability() {
  const controller = useAvailabilityController();
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  if (controller.status === "error") {
    return (
      <ScreenContainer>
        <ScreenTopBar title="Disponibilidade" onBack={controller.goBack} />
        <ErrorState
          message={
            controller.errorMessage ??
            "Não foi possível carregar a disponibilidade."
          }
          onRetry={controller.reload}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTopBar title="Disponibilidade" onBack={controller.goBack}>
        <Text style={[styles.explicacao, { color: palette.textMuted }]}>
          Quantos minutos você consegue estudar em cada dia. Dia com zero fica
          de fora da distribuição.
        </Text>
      </ScreenTopBar>

      {controller.status === "loading" ? (
        <View style={styles.lista}>
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
        </View>
      ) : (
        <View style={styles.lista}>
          {controller.rows.map((row) => (
            <TextField
              key={row.weekday}
              label={NOME_DO_DIA[row.weekday]}
              icon={ClockIcon}
              placeholder="0"
              value={row.minutes}
              onChangeText={(texto) =>
                controller.setMinutes(row.weekday, texto)
              }
              keyboardType="number-pad"
              maxLength={4}
              editable={!controller.saving}
            />
          ))}

          <Text style={styles.total}>
            {totalLegivel(controller.totalMinutes)}
          </Text>

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
            <Banner
              tone="info"
              message="Disponibilidade salva e calendário refeito."
            />
          ) : null}

          {controller.conflicts.map((conflict) => (
            <Banner
              key={`${conflict.kind}-${conflict.assessmentId}`}
              tone="warning"
              message={conflict.message}
            />
          ))}

          <ListRow
            title="Exceções"
            subtitle="Altere o tempo disponível em datas específicas"
            icon={CalendarIcon}
            onPress={controller.goToExceptions}
          />

          <Button
            label="Salvar disponibilidade"
            onPress={controller.save}
            loading={controller.saving}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  explicacao: {
    ...typography.screenSubtitle,
    marginBottom: spacing.md,
  },
  lista: {
    gap: spacing.lg,
  },
  total: {
    ...typography.caption,
    color: colors.textMuted,
  },
  erro: {
    ...typography.caption,
    color: colors.danger,
  },
});
