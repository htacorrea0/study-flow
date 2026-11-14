import { useRef, useState, type ComponentRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { InfoIcon } from "@/components/icons";

import {
  Button,
  Card,
  ConfirmDialog,
  ScreenContainer,
  Segmented,
} from "@/components/ui";
import { useTimerController } from "@/controllers/timer/TimerController";
import { colors, darkColors, radii, sizes, spacing, typography } from "@/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { formatStudyDuration } from "@/utils/duration";

/** Atalhos de duração. A digitação direta cobre qualquer outro valor. */
const TIMER_PRESETS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "10 min", seconds: 10 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 h", seconds: 60 * 60 },
] as const;

const MODE_OPTIONS = [
  { value: "timer", label: "Timer" },
  { value: "cronometro", label: "Cronômetro" },
  { value: "pomodoro", label: "Pomodoro" },
] as const;

/**
 * Aba Timer.
 *
 * Só mede e registra o tempo. O acumulado de estudo (por dia, por matéria e
 * no mês) fica na aba Progresso, em Tempo mensal.
 */
export default function Timer() {
  const controller = useTimerController();
  const [infoVisible, setInfoVisible] = useState(false);
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ink }]}>Timer</Text>
        <Pressable
          onPress={() => setInfoVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Como funciona"
          hitSlop={8}
          style={({ pressed }) => [
            styles.infoButton,
            pressed ? styles.infoPressed : null,
          ]}
        >
          <InfoIcon size={22} color={isDark ? darkColors.primaryDark : colors.primary} />
        </Pressable>
      </View>

      <InfoDialog
        visible={infoVisible}
        title={
          controller.mode === "timer"
            ? "Como funciona o timer"
            : controller.mode === "cronometro"
              ? "Como funciona o cronômetro"
              : "Como funciona o Pomodoro"
        }
        message={
          controller.mode === "timer"
            ? "Toque no tempo e digite quanto quer estudar, como no relógio do celular. Ao pausar ou terminar, você pode salvar o tempo no seu progresso. O acumulado fica em Progresso, em Tempo mensal."
            : controller.mode === "cronometro"
              ? "Use para medir sessões livres, sem tempo fixo. Marque trechos por matéria e, ao pausar, salve o tempo no seu progresso."
              : "Estude em ciclos configuráveis de foco e pausa. O tempo de foco é registrado no seu progresso."
        }
        onClose={() => setInfoVisible(false)}
      />

      <Segmented
        label="Modo"
        options={MODE_OPTIONS}
        value={controller.mode}
        onChange={controller.switchMode}
      />

      <View style={styles.subjectSection}>
        <Text style={[styles.subjectLabel, { color: palette.ink }]}>Matéria em foco</Text>

        {controller.subjectLoadStatus === "error" ? (
          <Text style={styles.subjectError}>{controller.subjectError}</Text>
        ) : controller.subjects.length === 0 ? (
          <Text style={styles.subjectHint}>
            {controller.subjectLoadStatus === "loading"
              ? "Carregando matérias..."
              : "Nenhuma matéria cadastrada. O tempo será registrado sem matéria."}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectChips}
            keyboardShouldPersistTaps="handled"
          >
            {controller.subjects.map((subject) => {
              const selected = subject.id === controller.selectedSubjectId;

              return (
                <Pressable
                  key={subject.id}
                  onPress={() => controller.setSelectedSubjectId(subject.id)}
                  accessibilityRole="radio"
                  accessibilityLabel={subject.name}
                  accessibilityState={{ selected, checked: selected }}
                  style={[
                    styles.subjectChip,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                    selected ? styles.subjectChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.subjectChipLabel,
                      { color: palette.ink },
                      selected ? styles.subjectChipLabelSelected : null,
                    ]}
                  >
                    {subject.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {controller.mode === "timer" ? (
        <CountdownPanel
          remainingFormatted={controller.countdownFormatted}
          progressPercent={controller.countdownProgressPercent}
          isRunning={controller.countdownRunning}
          isFinished={controller.countdownFinished}
          entryDigits={controller.entryDigits}
          entryFormatted={controller.entryFormatted}
          canEditDuration={controller.canEditDuration}
          canStart={controller.canStartCountdown}
          selectedPresetSeconds={controller.countdownDurationSeconds}
          onEntryChange={controller.setEntryDigits}
          onIncrease={controller.increaseCountdown}
          onDecrease={controller.decreaseCountdown}
          onPreset={controller.applyCountdownPreset}
          onStartPause={controller.startOrPauseCountdown}
          onReset={controller.resetCountdown}
        />
      ) : controller.mode === "cronometro" ? (
        <StopwatchPanel
          seconds={controller.stopwatchFormatted}
          isRunning={controller.stopwatchRunning}
          laps={controller.stopwatchLaps}
          onStartPause={controller.startOrPauseStopwatch}
          onReset={controller.resetStopwatch}
          onMarkLap={controller.markStopwatchLap}
        />
      ) : (
        <PomodoroPanel
          formatted={controller.pomodoroFormatted}
          phase={controller.pomodoroPhase}
          running={controller.pomodoroRunning}
          progressPercent={controller.pomodoroProgressPercent}
          completedFocuses={controller.pomodoroCompletedFocuses}
          focusMinutes={controller.pomodoroFocusMinutes}
          shortBreakMinutes={controller.pomodoroShortBreakMinutes}
          longBreakMinutes={controller.pomodoroLongBreakMinutes}
          onFocusMinutesChange={controller.setPomodoroFocusMinutes}
          onShortBreakMinutesChange={controller.setPomodoroShortBreakMinutes}
          onLongBreakMinutesChange={controller.setPomodoroLongBreakMinutes}
          onStartPause={controller.startOrPausePomodoro}
          onReset={controller.resetPomodoro}
        />
      )}

      {controller.registerFeedback === null ? null : (
        <Text style={styles.feedback} accessibilityLiveRegion="polite">
          {controller.registerFeedback}
        </Text>
      )}

      <ConfirmDialog
        visible={controller.registerPromptVisible}
        title="Salvar tempo estudado?"
        message={`Você estudou ${formatStudyDuration(controller.registerPromptSeconds)} em ${controller.selectedSubjectName}. Quer registrar esse tempo no seu progresso?`}
        confirmLabel="Salvar"
        cancelLabel="Agora não"
        confirming={controller.registeringStudyTime}
        onConfirm={controller.confirmRegisterStudyTime}
        onCancel={controller.cancelRegisterStudyTime}
      />
    </ScreenContainer>
  );
}

type InfoDialogProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly onClose: () => void;
};

/** Pop-up de explicação aberto pelo ícone ⓘ. */
function InfoDialog({ visible, title, message, onClose }: InfoDialogProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.infoBackdrop}>
        <View style={[styles.infoBox, { backgroundColor: palette.surface }]}>
          <Text style={[styles.infoTitle, { color: palette.ink }]}>{title}</Text>
          <Text style={[styles.infoMessage, { color: palette.textMuted }]}>{message}</Text>
          <Button label="Entendi" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

type DurationEntryProps = {
  readonly digits: string;
  readonly formatted: string;
  readonly editable: boolean;
  readonly onChange: (value: string) => void;
};

/**
 * Tempo digitável no estilo do relógio do celular.
 *
 * A pessoa toca no tempo e digita só números: eles entram pela direita e
 * empurram os anteriores (`2`, `5`, `0`, `0` mostra 00h 25m 00s). O campo de
 * texto fica invisível por cima do texto formatado; ele só existe para abrir
 * o teclado numérico e receber os dígitos.
 */
function DurationEntry({
  digits,
  formatted,
  editable,
  onChange,
}: DurationEntryProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      disabled={!editable}
      accessibilityRole="button"
      accessibilityLabel={`Tempo do timer: ${formatted}. Toque para digitar outro tempo.`}
      style={styles.entry}
    >
      <Text
        style={[
          styles.timeEntry,
          { color: palette.ink },
          focused ? { color: isDark ? darkColors.primaryDark : colors.primary } : null,
          digits === "" ? styles.timeEntryEmpty : null,
        ]}
      >
        {formatted}
      </Text>

      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        maxLength={6}
        caretHidden
        accessibilityLabel="Digitar tempo do timer"
        style={styles.entryInput}
      />
    </Pressable>
  );
}

type CountdownPanelProps = {
  readonly remainingFormatted: string;
  readonly progressPercent: number;
  readonly isRunning: boolean;
  readonly isFinished: boolean;
  readonly entryDigits: string;
  readonly entryFormatted: string;
  readonly canEditDuration: boolean;
  readonly canStart: boolean;
  readonly selectedPresetSeconds: number;
  readonly onEntryChange: (value: string) => void;
  readonly onIncrease: () => void;
  readonly onDecrease: () => void;
  readonly onPreset: (seconds: number) => void;
  readonly onStartPause: () => void;
  readonly onReset: () => void;
};

function CountdownPanel({
  remainingFormatted,
  progressPercent,
  isRunning,
  isFinished,
  entryDigits,
  entryFormatted,
  canEditDuration,
  canStart,
  selectedPresetSeconds,
  onEntryChange,
  onIncrease,
  onDecrease,
  onPreset,
  onStartPause,
  onReset,
}: CountdownPanelProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={styles.section}>
      <Card size="large" style={styles.timeCard}>
        <Text style={[styles.modeLabel, { color: isDark ? darkColors.primaryDark : colors.primary }]}>Timer</Text>

        {canEditDuration ? (
          <>
            <DurationEntry
              digits={entryDigits}
              formatted={entryFormatted}
              editable={canEditDuration}
              onChange={onEntryChange}
            />
          </>
        ) : (
          <>
            <Text style={[styles.time, { color: palette.ink }]}>{remainingFormatted}</Text>
            <Text style={[styles.helper, { color: palette.textMuted }]}>
              {isFinished
                ? "Tempo concluído."
                : isRunning
                  ? "Em andamento."
                  : "Pausado."}
            </Text>
          </>
        )}

        <View style={[styles.progressTrack, { backgroundColor: palette.primaryGlow }]} accessibilityElementsHidden>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>

        {canEditDuration ? (
          <>
            <View style={styles.adjustRow}>
              <Pressable
                onPress={onDecrease}
                accessibilityRole="button"
                accessibilityLabel="Diminuir 1 minuto"
                style={[styles.adjustButton, { backgroundColor: palette.primaryGlow }]}
              >
                <Text style={[styles.adjustLabel, { color: isDark ? darkColors.primaryDark : colors.primary }]}>- 1 min</Text>
              </Pressable>
              <Pressable
                onPress={onIncrease}
                accessibilityRole="button"
                accessibilityLabel="Aumentar 1 minuto"
                style={[styles.adjustButton, { backgroundColor: palette.primaryGlow }]}
              >
                <Text style={[styles.adjustLabel, { color: isDark ? darkColors.primaryDark : colors.primary }]}>+ 1 min</Text>
              </Pressable>
            </View>

            <View style={styles.presetRow}>
              {TIMER_PRESETS.map((preset) => {
                const selected = preset.seconds === selectedPresetSeconds;

                return (
                  <View key={preset.seconds} style={styles.presetWrap}>
                    <Pressable
                      onPress={() => onPreset(preset.seconds)}
                      accessibilityRole="button"
                      accessibilityLabel={preset.label}
                      accessibilityState={{ selected }}
                      style={[
                        styles.presetButton,
                        { backgroundColor: palette.surface, borderColor: palette.border },
                        selected ? styles.presetButtonSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetLabel,
                          { color: palette.ink },
                          selected ? styles.presetLabelSelected : null,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button
          label={
            isFinished
              ? "Reiniciar e iniciar"
              : isRunning
                ? "Pausar"
                : "Iniciar"
          }
          onPress={onStartPause}
          disabled={!canStart}
        />
        <Button label="Resetar" onPress={onReset} variant="secondary" />
      </View>
    </View>
  );
}

type StopwatchPanelProps = {
  readonly seconds: string;
  readonly isRunning: boolean;
  readonly laps: readonly {
    readonly id: string;
    readonly subjectName: string;
    readonly seconds: number;
  }[];
  readonly onStartPause: () => void;
  readonly onReset: () => void;
  readonly onMarkLap: () => void;
};

function StopwatchPanel({
  seconds,
  isRunning,
  laps,
  onStartPause,
  onReset,
  onMarkLap,
}: StopwatchPanelProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={styles.section}>
      <Card size="large" style={styles.timeCard}>
        <Text style={[styles.modeLabel, { color: isDark ? darkColors.primaryDark : colors.primary }]}>Cronômetro</Text>
        <Text style={[styles.time, { color: palette.ink }]}>{seconds}</Text>

        <View style={{ paddingVertical: spacing.md, width: "100%" }}>
          <Button
            label="Marcar tempo desta matéria"
            onPress={onMarkLap}
            variant="secondary"
          />
        </View>

        {laps.length === 0 ? (
          <Text style={[styles.lapHint, { color: palette.textMuted }]}>Nenhum trecho marcado ainda.</Text>
        ) : (
          <View style={styles.lapList}>
            {laps.slice(0, 4).map((lap, index) => (
              <View key={lap.id} style={styles.lapItem}>
                <Text style={[styles.lapLabel, { color: isDark ? darkColors.primaryDark : colors.primary }]}>
                  Trecho {laps.length - index}
                </Text>
                <Text style={[styles.lapText, { color: palette.ink }]}>{lap.subjectName}</Text>
                <Text style={[styles.lapText, { color: palette.ink }]}>
                  {formatStudyDuration(lap.seconds)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          label={isRunning ? "Pausar" : "Iniciar"}
          onPress={onStartPause}
        />
        <Button label="Zerar" onPress={onReset} variant="secondary" />
      </View>
    </View>
  );
}

type PomodoroPanelProps = {
  readonly formatted: string;
  readonly phase: "focus" | "shortBreak" | "longBreak";
  readonly running: boolean;
  readonly progressPercent: number;
  readonly completedFocuses: number;
  readonly focusMinutes: string;
  readonly shortBreakMinutes: string;
  readonly longBreakMinutes: string;
  readonly onFocusMinutesChange: (value: string) => void;
  readonly onShortBreakMinutesChange: (value: string) => void;
  readonly onLongBreakMinutesChange: (value: string) => void;
  readonly onStartPause: () => void;
  readonly onReset: () => void;
};

function PomodoroPanel({
  formatted,
  phase,
  running,
  progressPercent,
  completedFocuses,
  focusMinutes,
  shortBreakMinutes,
  longBreakMinutes,
  onFocusMinutesChange,
  onShortBreakMinutesChange,
  onLongBreakMinutesChange,
  onStartPause,
  onReset,
}: PomodoroPanelProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;
  const phaseLabel =
    phase === "focus"
      ? "Foco"
      : phase === "shortBreak"
        ? "Pausa curta"
        : "Pausa longa";

  return (
    <View style={styles.section}>
      <View style={styles.pomodoroSettings}>
        <Text style={[styles.subjectLabel, { color: palette.ink }]}>Duração dos ciclos (minutos)</Text>
        <View style={styles.pomodoroInputs}>
          <View style={styles.pomodoroInputGroup}>
            <Text style={[styles.pomodoroInputLabel, { color: palette.textMuted }]}>Foco</Text>
            <TextInput
              value={focusMinutes}
              onChangeText={onFocusMinutesChange}
              keyboardType="number-pad"
              maxLength={3}
              editable={!running}
              style={[styles.pomodoroInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink }]}
              accessibilityLabel="Minutos de foco"
            />
          </View>
          <View style={styles.pomodoroInputGroup}>
            <Text style={[styles.pomodoroInputLabel, { color: palette.textMuted }]}>Pausa curta</Text>
            <TextInput
              value={shortBreakMinutes}
              onChangeText={onShortBreakMinutesChange}
              keyboardType="number-pad"
              maxLength={3}
              editable={!running}
              style={[styles.pomodoroInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink }]}
              accessibilityLabel="Minutos da pausa curta"
            />
          </View>
          <View style={styles.pomodoroInputGroup}>
            <Text style={[styles.pomodoroInputLabel, { color: palette.textMuted }]}>Pausa longa</Text>
            <TextInput
              value={longBreakMinutes}
              onChangeText={onLongBreakMinutesChange}
              keyboardType="number-pad"
              maxLength={3}
              editable={!running}
              style={[styles.pomodoroInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink }]}
              accessibilityLabel="Minutos da pausa longa"
            />
          </View>
        </View>
      </View>
      <Card size="large" style={styles.timeCard}>
        <Text style={[styles.modeLabel, { color: isDark ? darkColors.primaryDark : colors.primary }]}>{phaseLabel}</Text>
        <Text style={[styles.time, { color: palette.ink }]}>{formatted}</Text>
        <Text style={[styles.helper, { color: palette.textMuted }]}>
          {running ? "Em andamento." : "Pronto para começar."}
        </Text>

        <View style={[styles.progressTrack, { backgroundColor: palette.primaryGlow }]} accessibilityElementsHidden>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>

        <Text style={[styles.pomodoroCount, { color: palette.textMuted }]}>
          {completedFocuses}{" "}
          {completedFocuses === 1 ? "foco concluído" : "focos concluídos"}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button label={running ? "Pausar" : "Iniciar"} onPress={onStartPause} />
        <Button label="Reiniciar ciclo" onPress={onReset} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.screenTitle,
    fontSize: 30,
    lineHeight: 38,
  },
  infoButton: {
    alignItems: "center",
    height: sizes.minTouchTarget,
    justifyContent: "center",
    width: sizes.minTouchTarget,
  },
  infoPressed: {
    opacity: 0.6,
  },
  infoBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(30, 27, 75, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xxl,
  },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.xxl,
    width: "100%",
  },
  infoTitle: {
    ...typography.sectionTitle,
  },
  infoMessage: {
    ...typography.screenSubtitle,
    marginBottom: spacing.sm,
  },
  subjectSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  subjectLabel: {
    ...typography.label,
  },
  subjectHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subjectError: {
    ...typography.caption,
    color: colors.danger,
  },
  subjectChips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  subjectChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: sizes.secondaryButtonHeight,
    paddingHorizontal: spacing.lg,
  },
  subjectChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subjectChipLabel: {
    ...typography.button,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  subjectChipLabelSelected: {
    color: colors.white,
  },
  section: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  pomodoroSettings: {
    gap: spacing.sm,
  },
  pomodoroInputs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pomodoroInputGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  pomodoroInputLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pomodoroInput: {
    ...typography.input,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    minHeight: sizes.secondaryButtonHeight,
    paddingHorizontal: spacing.md,
    textAlign: "center",
  },
  timeCard: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  modeLabel: {
    ...typography.label,
    color: colors.primary,
  },
  time: {
    ...typography.screenTitle,
    color: colors.ink,
    fontSize: 48,
    lineHeight: 56,
  },
  entry: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.minTouchTarget,
  },
  timeEntry: {
    ...typography.screenTitle,
    color: colors.ink,
    fontSize: 38,
    lineHeight: 48,
  },
  timeEntryFocused: {
    color: colors.primary,
  },
  timeEntryEmpty: {
    color: colors.textSubtle,
  },
  // Invisível, por cima do tempo: só abre o teclado e recebe os dígitos.
  entryInput: {
    bottom: 0,
    left: 0,
    opacity: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
  },
  progressTrack: {
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.pill,
    height: 8,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: "100%",
  },
  adjustRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  adjustButton: {
    alignItems: "center",
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: sizes.minTouchTarget,
    minWidth: 88,
    paddingHorizontal: spacing.sm,
  },
  adjustLabel: {
    ...typography.button,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  presetRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  presetWrap: {
    flex: 1,
  },
  presetButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: sizes.secondaryButtonHeight,
  },
  presetButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetLabel: {
    ...typography.button,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  presetLabelSelected: {
    color: colors.white,
  },
  lapHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  lapList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    width: "100%",
  },
  lapItem: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  lapLabel: {
    ...typography.footerText,
    color: colors.primary,
    fontSize: 12,
    lineHeight: 16,
  },
  lapText: {
    ...typography.caption,
    color: colors.ink,
  },
  actions: {
    gap: spacing.md,
  },
  feedback: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.md,
  },
  pomodoroCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
