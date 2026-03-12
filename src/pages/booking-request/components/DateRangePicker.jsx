import React, { useEffect, useState } from 'react';
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isBefore, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import {
  buildBlockedDateSet,
  isDateAllowedByWeekdays,
  isDateBlocked,
  normalizeScheduleWeekdays,
  rangeContainsBlockedDate
} from '../../../utils/availabilityRules';

const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  unavailableDates = [],
  allowedStartWeekdays = [],
  allowedEndWeekdays = [],
  minDate = addDays(new Date(), 1)
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(startDate || new Date()));
  const [selectingStart, setSelectingStart] = useState(true);
  const blockedDaySet = buildBlockedDateSet(unavailableDates || []);
  const startWeekdays = normalizeScheduleWeekdays(allowedStartWeekdays);
  const endWeekdays = normalizeScheduleWeekdays(allowedEndWeekdays);

  useEffect(() => {
    if (startDate && !endDate) {
      setSelectingStart(false);
      return;
    }

    setSelectingStart(true);
  }, [startDate, endDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const isDateDisabled = (date) => {
    const dayStart = startOfDay(date);
    const minDateStart = startOfDay(minDate);
    const dayConstraint = selectingStart || !startDate ? startWeekdays : endWeekdays;

    return (
      isBefore(dayStart, minDateStart)
      || isDateBlocked(dayStart, blockedDaySet)
      || !isDateAllowedByWeekdays(dayStart, dayConstraint)
    );
  };

  const isDateInRange = (date) => {
    if (!startDate || !endDate) return false;
    const dayStart = startOfDay(date);
    return isAfter(dayStart, startOfDay(startDate)) && isBefore(dayStart, startOfDay(endDate));
  };

  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return;

    if (selectingStart || !startDate) {
      onChange?.(date, null);
      setSelectingStart(false);
    } else {
      if (isBefore(date, startDate)) {
        // If clicked date is before start, set it as new start
        onChange?.(date, null);
      } else {
        // Check if there are unavailable dates in the range
        const hasUnavailableInRange = rangeContainsBlockedDate(startDate, date, blockedDaySet);

        if (hasUnavailableInRange) {
          // Reset selection if range contains unavailable dates
          onChange?.(date, null);
          setSelectingStart(false);
        } else {
          onChange?.(startDate, date);
          setSelectingStart(true);
        }
      }
    }
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Adjust days to start from Monday
  const getWeekDay = (date) => {
    const day = date?.getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, and shift others
  };

  // Calculate offset for first day of month
  const firstDayOffset = getWeekDay(monthStart);

  const hasCompleteSelection = Boolean(startDate && endDate);
  const waitingForStart = !hasCompleteSelection && (!startDate || selectingStart);
  const waitingForEnd = !!startDate && !endDate && !selectingStart;

  const instructionTitle = waitingForStart
    ? 'Etape 1 : cliquez sur la date de debut'
    : waitingForEnd
      ? 'Etape 2 : cliquez sur la date de fin'
      : 'Periode selectionnee';

  const instructionDescription = waitingForStart
    ? 'Selectionnez le premier jour de votre reservation.'
    : waitingForEnd
      ? 'Selectionnez le dernier jour de votre reservation.'
      : 'Cliquez sur une nouvelle date de debut pour modifier la periode.';

  const startDateLabel = startDate
    ? format(startDate, 'dd MMM yyyy', { locale: fr })
    : 'Non choisi';

  const endDateLabel = endDate
    ? format(endDate, 'dd MMM yyyy', { locale: fr })
    : (startDate ? "Cliquez sur une date de fin" : "Choisissez d'abord un début");

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-primary/15 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <Icon
            name={waitingForEnd ? 'Flag' : waitingForStart ? 'MousePointerClick' : 'CheckCircle'}
            size={16}
            className="text-primary mt-0.5"
          />
          <div>
            <p className="text-sm font-medium text-foreground">{instructionTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{instructionDescription}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <div
            className={cn(
              'rounded-md border bg-white px-3 py-2',
              waitingForStart ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
            )}
          >
            <p className="text-xs text-muted-foreground">Debut</p>
            <p className="text-sm font-medium text-foreground">{startDateLabel}</p>
          </div>
          <div
            className={cn(
              'rounded-md border bg-white px-3 py-2',
              waitingForEnd ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
            )}
          >
            <p className="text-xs text-muted-foreground">Fin</p>
            <p className="text-sm font-medium text-foreground">{endDateLabel}</p>
          </div>
        </div>
      </div>
      {/* Calendar En-tête */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePreviousMonth}
          iconName="ChevronLeft"
        />
        <h3 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNextMonth}
          iconName="ChevronRight"
        />
      </div>

      {/* Week Days En-tête */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays?.map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOffset })?.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Date cells */}
        {daysInMonth?.map(date => {
          const isDisabled = isDateDisabled(date);
          const isSelected = (startDate && isSameDay(date, startDate)) || (endDate && isSameDay(date, endDate));
          const isInRange = isDateInRange(date);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={date?.toISOString()}
              type="button"
              onClick={() => handleDateClick(date)}
              disabled={isDisabled}
              className={cn(
                'aspect-square rounded-md text-sm font-medium transition-colors',
                'hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-primary',
                isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent line-through',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isInRange && !isSelected && 'bg-primary/20',
                isToday && !isSelected && 'border-2 border-primary',
                !isDisabled && !isSelected && !isInRange && 'hover:bg-accent/10'
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-primary" />
          <span>Aujourd'hui</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary" />
          <span>Sélectionné</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted line-through" />
          <span>Indisponible</span>
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
