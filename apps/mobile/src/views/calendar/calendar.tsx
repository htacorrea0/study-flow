import { ScreenContainer } from '@/components/ui';
import { useCalendarController } from '@/controllers/calendar/CalendarController';
import { ErrorState } from '@/views/_templates/_errorState';
import { dayLabel } from '@/utils/date';
import { AgendaList } from './_agendaList';
import { CalendarHeader } from './_calendarHeader';
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

      <AgendaList
        title={titulo}
        assessments={controller.dayAssessments}
        sessions={controller.daySessions}
        loading={controller.dayStatus === 'loading'}
      />
    </ScreenContainer>
  );
}
