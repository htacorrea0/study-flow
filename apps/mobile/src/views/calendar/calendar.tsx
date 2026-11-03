import { StyleSheet, View } from 'react-native';

import { ListRow, ScreenContainer } from '@/components/ui';
import { useCalendarController } from '@/controllers/calendar/CalendarController';
import { AlertTriangleIcon } from '@/components/icons';
import { spacing } from '@/theme';
import { ErrorState } from '@/views/_templates/_errorState';
import { dayLabel } from '@/utils/date';
import { AgendaList } from './_agendaList';
import { CalendarHeader } from './_calendarHeader';
import { ConfirmationPanel } from './_confirmationPanel';
import { MonthGrid } from './_monthGrid';
import { MonthSelector } from './_monthSelector';

/**
 * Tela do calendário, frame `5:874` do Figma.
 *
 * A grade é desenhada sempre, inclusive enquanto as marcações do mês
 * carregam: ela não depende da rede, e esconder outubro atrás de um spinner
 * seria perder a única parte da tela que já está pronta. Só a agenda do dia
 * tem estado de carregamento próprio.
 *
 * O erro ocupa a tela toda porque, falhando as duas buscas, não sobra
 * conteúdo com que interagir.
 */
export default function Calendar() {
  const controller = useCalendarController();

  const falhouTudo =
    controller.monthStatus === 'error' && controller.dayStatus === 'error';

  if (falhouTudo) {
    return (
      <ScreenContainer edgeToEdge>
        <CalendarHeader onGoToToday={controller.goToToday} />
        <ErrorState
          message={controller.errorMessage ?? 'Não foi possível carregar o calendário.'}
          onRetry={controller.reload}
        />
      </ScreenContainer>
    );
  }

  const titulo =
    controller.selectedDate === controller.today
      ? 'Agenda de hoje'
      : `Agenda de ${dayLabel(controller.selectedDate)}`;

  return (
    <ScreenContainer edgeToEdge>
      <CalendarHeader onGoToToday={controller.goToToday} />

      <MonthSelector
        label={controller.label}
        onPrevious={controller.goToPreviousMonth}
        onNext={controller.goToNextMonth}
      />

      <MonthGrid
        matrix={controller.matrix}
        marksByDate={controller.marksByDate}
        selectedDate={controller.selectedDate}
        today={controller.today}
        onSelect={controller.selectDate}
      />

      {controller.needsAvailability === true ? (
        <View style={styles.aviso}>
          <ListRow
            title="Sem tempo de estudo definido"
            subtitle="Diga quantos minutos você tem por dia para o app montar o seu plano."
            icon={AlertTriangleIcon}
            onPress={controller.goToAvailability}
          />
        </View>
      ) : null}

      <AgendaList
        title={titulo}
        assessments={controller.dayAssessments}
        sessions={controller.daySessions}
        loading={controller.dayStatus === 'loading'}
      />

      {controller.dayStatus === 'ready' ? (
        <View style={styles.painel}>
          <ConfirmationPanel
            date={controller.selectedDate}
            today={controller.today}
            sessions={controller.daySessions}
            onConfirmed={controller.reload}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  aviso: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  painel: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
});
