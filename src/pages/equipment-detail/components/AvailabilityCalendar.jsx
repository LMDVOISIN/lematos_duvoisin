import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState('start');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(startDate || new Date()));
  const [calendarPlacement, setCalendarPlacement] = useState({
    openUpward: false,
    maxHeight: 320
  });
  const rootRef = useRef(null);

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
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (rootRef?.current && !rootRef.current.contains(event?.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePlacement = () => {
      const rect = rootRef?.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportHeight = window?.innerHeight || document?.documentElement?.clientHeight || 800;
      const margin = 12;
      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - margin);
      const spaceAbove = Math.max(0, rect.top - margin);

      const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableSpace = openUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(220, Math.min(420, Math.floor(availableSpace)));

      setCalendarPlacement((previous) => {
        if (
          previous?.openUpward === openUpward
          && Math.abs((previous?.maxHeight || 0) - maxHeight) < 4
        ) {
          return previous;
        }

        return { openUpward, maxHeight };
      });
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);

    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen]);

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
    setIsOpen(false);
  };

  const startLabel = normalizedStartDate
    ? format(normalizedStartDate, 'dd MMM yyyy', { locale: fr })
    : 'Cliquer pour choisir';

  const endLabel = normalizedEndDate
    ? format(normalizedEndDate, 'dd MMM yyyy', { locale: fr })
    : (normalizedStartDate ? 'Cliquer pour choisir' : "Choisir d'abord un début");

  return (
    <div ref={rootRef} className="relative">
      <div className="rounded-lg border border-[#17a2b8]/20 bg-[#17a2b8]/5 p-3">
        <p className="text-sm font-medium text-foreground">Choisissez vos dates</p>
        <p className="text-xs text-muted-foreground mt-1">Sélection sur place, sans quitter la page.</p>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              setActiveField('start');
              setIsOpen(true);
            }}
            className={cn(
              'rounded-md border bg-white px-3 py-2 text-left transition-colors',
              activeField === 'start' && isOpen ? 'border-[#17a2b8]/60 ring-1 ring-[#17a2b8]/30' : 'border-border'
            )}
          >
            <p className="text-xs text-muted-foreground">Début</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{startLabel}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveField('end');
              setIsOpen(true);
            }}
            className={cn(
              'rounded-md border bg-white px-3 py-2 text-left transition-colors',
              activeField === 'end' && isOpen ? 'border-[#17a2b8]/60 ring-1 ring-[#17a2b8]/30' : 'border-border'
            )}
          >
            <p className="text-xs text-muted-foreground">Fin</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{endLabel}</p>
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-30 w-full rounded-xl border border-border bg-white p-2 shadow-xl',
            calendarPlacement?.openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
          style={{ maxHeight: `${calendarPlacement?.maxHeight}px` }}
        >
          <div className="sticky top-0 z-10 bg-white pb-1">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="h-7 w-7 rounded-md border border-border hover:bg-muted/50"
              >
                <Icon name="ChevronLeft" size={14} className="mx-auto" />
              </button>
              <p className="text-sm font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </p>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="h-7 w-7 rounded-md border border-border hover:bg-muted/50"
              >
                <Icon name="ChevronRight" size={14} className="mx-auto" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays?.map((day, index) => (
                <div key={`${day}-${index}`} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto pr-1" style={{ maxHeight: `calc(${calendarPlacement?.maxHeight}px - 86px)` }}>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOffset })?.map((_, index) => (
                <div key={`empty-${index}`} className="h-7" />
              ))}

              {daysInMonth?.map((date) => {
                const isDisabled = isDateDisabled(date);
                const isSelected = (normalizedStartDate && isSameDay(date, normalizedStartDate))
                  || (normalizedEndDate && isSameDay(date, normalizedEndDate));
                const isInRange = isDateInRange(date);
                const isToday = isSameDay(date, new Date());

                return (
                  <button
                    key={date?.toISOString()}
                    type="button"
                    onClick={() => handleDateClick(date)}
                    disabled={isDisabled}
                    className={cn(
                      'h-7 rounded-md text-xs transition-colors',
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
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{activeField === 'start' ? 'Choisissez un debut' : 'Choisissez une fin'}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="underline hover:text-foreground"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;

