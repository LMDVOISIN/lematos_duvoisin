import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths
} from 'date-fns';
import { fr } from 'date-fns/locale';
import Icon from '../../../components/AppIcon';
import { cn } from '../../../utils/cn';
import {
  buildBlockedDateSet,
  isDateAllowedByWeekdays,
  isDateBlocked,
  normalizeScheduleWeekdays,
  rangeContainsBlockedDate
} from '../../../utils/availabilityRules';

const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const AvailabilityCalendar = ({
  startDate,
  endDate,
  onChange,
  unavailableDates = [],
  allowedStartWeekdays = [],
  allowedEndWeekdays = [],
  minDate = addDays(new Date(), 1)
}) => {
  const [activeField, setActiveField] = useState('start');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(startDate || new Date()));

  const blockedDaySet = useMemo(
    () => buildBlockedDateSet(unavailableDates || []),
    [unavailableDates]
  );
  const allowedStartDays = useMemo(
    () => normalizeScheduleWeekdays(allowedStartWeekdays),
    [allowedStartWeekdays]
  );
  const allowedEndDays = useMemo(
    () => normalizeScheduleWeekdays(allowedEndWeekdays),
    [allowedEndWeekdays]
  );

  const normalizedStartDate = startDate ? startOfDay(startDate) : null;
  const normalizedEndDate = endDate ? startOfDay(endDate) : null;
  const normalizedMinDate = startOfDay(minDate);

  useEffect(() => {
    if (!normalizedStartDate || normalizedEndDate) {
      setActiveField('start');
      return;
    }

    setActiveField('end');
  }, [normalizedEndDate, normalizedStartDate]);

  useEffect(() => {
    if (!startDate) return;
    const nextStartDate = startOfDay(startDate);
    if (!nextStartDate || Number.isNaN(nextStartDate?.getTime())) return;
    setCurrentMonth(startOfMonth(nextStartDate));
  }, [startDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getWeekDayOffset = (date) => {
    const day = date?.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const firstDayOffset = getWeekDayOffset(monthStart);

  const isDateDisabled = (date) => {
    const normalizedDate = startOfDay(date);
    const mustValidateAsEndDate = activeField === 'end' && normalizedStartDate && !normalizedEndDate;
    const dayConstraint = mustValidateAsEndDate ? allowedEndDays : allowedStartDays;

    return (
      isBefore(normalizedDate, normalizedMinDate)
      || isDateBlocked(normalizedDate, blockedDaySet)
      || !isDateAllowedByWeekdays(normalizedDate, dayConstraint)
    );
  };

  const isDateInRange = (date) => {
    if (!normalizedStartDate || !normalizedEndDate) return false;
    const normalizedDate = startOfDay(date);
    return isAfter(normalizedDate, normalizedStartDate) && isBefore(normalizedDate, normalizedEndDate);
  };

  const hasUnavailableBetween = (fromDate, toDate) => {
    if (!fromDate || !toDate) return false;
    return rangeContainsBlockedDate(fromDate, toDate, blockedDaySet);
  };

  const applySelection = (nextStartDate, nextEndDate) => {
    onChange?.(nextStartDate, nextEndDate);
  };

  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return;

    if (activeField === 'start' || !normalizedStartDate || (normalizedStartDate && normalizedEndDate)) {
      applySelection(startOfDay(date), null);
      setActiveField('end');
      return;
    }

    if (isBefore(date, normalizedStartDate)) {
      applySelection(startOfDay(date), null);
      setActiveField('end');
      return;
    }

    if (hasUnavailableBetween(normalizedStartDate, date)) {
      applySelection(startOfDay(date), null);
      setActiveField('end');
      return;
    }

    applySelection(normalizedStartDate, startOfDay(date));
    setActiveField('start');
  };

  const startLabel = normalizedStartDate
    ? format(normalizedStartDate, 'dd MMM yyyy', { locale: fr })
    : 'Cliquer pour choisir';

  const endLabel = normalizedEndDate
    ? format(normalizedEndDate, 'dd MMM yyyy', { locale: fr })
    : (normalizedStartDate ? 'Cliquer pour choisir' : "Choisir d'abord un début");

  return (
    <div className="rounded-lg border border-[#17a2b8]/20 bg-[#17a2b8]/5 p-3">
      <p className="text-sm font-medium text-foreground">Choisissez vos dates</p>
      <p className="mt-1 text-xs text-muted-foreground">Sélection sur place, sans quitter la page.</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveField('start')}
          className={cn(
            'rounded-md border bg-white px-3 py-2 text-left transition-colors',
            activeField === 'start' ? 'border-[#17a2b8]/60 ring-1 ring-[#17a2b8]/30' : 'border-border'
          )}
        >
          <p className="text-xs text-muted-foreground">Début</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{startLabel}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveField('end')}
          className={cn(
            'rounded-md border bg-white px-3 py-2 text-left transition-colors',
            activeField === 'end' ? 'border-[#17a2b8]/60 ring-1 ring-[#17a2b8]/30' : 'border-border'
          )}
        >
          <p className="text-xs text-muted-foreground">Fin</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{endLabel}</p>
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-white p-2 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="h-8 w-8 rounded-md border border-border hover:bg-muted/50"
            aria-label="Mois précédent"
          >
            <Icon name="ChevronLeft" size={14} className="mx-auto" />
          </button>
          <p className="text-sm font-semibold capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </p>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="h-8 w-8 rounded-md border border-border hover:bg-muted/50"
            aria-label="Mois suivant"
          >
            <Icon name="ChevronRight" size={14} className="mx-auto" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {weekDays.map((day, index) => (
            <div key={`${day}-${index}`} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, index) => (
            <div key={`empty-${index}`} className="h-8" />
          ))}

          {daysInMonth.map((date) => {
            const isDisabled = isDateDisabled(date);
            const isSelected = (normalizedStartDate && isSameDay(date, normalizedStartDate))
              || (normalizedEndDate && isSameDay(date, normalizedEndDate));
            const isInRange = isDateInRange(date);
            const isToday = isSameDay(date, new Date());

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleDateClick(date)}
                disabled={isDisabled}
                className={cn(
                  'h-8 rounded-md text-xs transition-colors',
                  isDisabled && 'cursor-not-allowed text-muted-foreground/40 line-through',
                  isSelected && 'bg-[#17a2b8] text-white font-semibold',
                  isInRange && !isSelected && 'bg-[#17a2b8]/20',
                  isToday && !isSelected && 'border border-[#17a2b8]/50',
                  !isDisabled && !isSelected && !isInRange && 'hover:bg-[#17a2b8]/10'
                )}
              >
                {format(date, 'd')}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{activeField === 'start' ? 'Choisissez un début' : 'Choisissez une fin'}</span>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
