import React, { useEffect, useMemo, useState } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import Input from '../../../components/ui/Input';
import { cn } from '../../../utils/cn';
import { buildBlockedDateSet, toDateOnlyString } from '../../../utils/availabilityRules';
import { normalizeTimeValue } from '../../../utils/timeSlots';

const DisponibilitesStep = ({ formData, updateFormData, errors }) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const unavailableDateSet = useMemo(
    () => buildBlockedDateSet(formData?.unavailableDates || []),
    [formData?.unavailableDates]
  );
  const normalizedUnavailableDates = useMemo(
    () => Array.from(unavailableDateSet.values())?.sort(),
    [unavailableDateSet]
  );

  const isDateUnavailable = (date) => {
    const dateString = toDateOnlyString(date);
    return Boolean(dateString && unavailableDateSet.has(dateString));
  };

  const handleDateClick = (date) => {
    const dateString = toDateOnlyString(date);
    if (!dateString) return;

    const isCurrentlyUnavailable = isDateUnavailable(date);

    if (isCurrentlyUnavailable) {
      const updatedDates = normalizedUnavailableDates?.filter((d) => d !== dateString);
      updateFormData('unavailableDates', updatedDates);
      return;
    }

    updateFormData('unavailableDates', [...normalizedUnavailableDates, dateString]?.sort());
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const fullWeekDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const getWeekDay = (date) => {
    const day = date?.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const firstDayOffset = getWeekDay(monthStart);

  const parseTimeToMinutes = (time) => {
    const normalizedTime = normalizeTimeValue(time);
    if (!normalizedTime) return null;
    const [hours, minutes] = normalizedTime?.split(':')?.map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
  };

  const formatMinutesToTime = (minutes) => {
    if (!Number.isFinite(minutes)) return '';
    const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
    const hours = Math.floor(clamped / 60);
    const mins = clamped % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const addMinutesToTime = (time, deltaMinutes) => {
    const parsed = parseTimeToMinutes(time);
    if (parsed === null) return '';
    return formatMinutesToTime(parsed + deltaMinutes);
  };

  const clampTimeInRange = (time, minTime, maxTime) => {
    const timeMinutes = parseTimeToMinutes(time);
    const minMinutes = parseTimeToMinutes(minTime);
    const maxMinutes = parseTimeToMinutes(maxTime);

    if (timeMinutes === null) return time;
    if (minMinutes === null || maxMinutes === null) return time;
    if (minMinutes > maxMinutes) return minTime;
    if (timeMinutes < minMinutes) return minTime;
    if (timeMinutes > maxMinutes) return maxTime;
    return time;
  };

  const getPickupEndBounds = (startTime) => {
    const safeStart = startTime || '08:30';
    return {
      min: safeStart,
      max: addMinutesToTime(safeStart, 60) || safeStart
    };
  };

  const getReturnEndBounds = (startTime) => {
    const safeStart = startTime || '18:30';
    const oneHourAfter = addMinutesToTime(safeStart, 60) || safeStart;
    const max = parseTimeToMinutes(oneHourAfter) !== null && parseTimeToMinutes(oneHourAfter) < parseTimeToMinutes('19:30')
      ? oneHourAfter
      : '19:30';

    return {
      min: safeStart,
      max
    };
  };

  const pickupDays = Array.isArray(formData?.pickupDays) ? formData?.pickupDays : [];
  const returnDays = Array.isArray(formData?.returnDays) ? formData?.returnDays : [];
  const pickupTimeStart = formData?.pickupTimeStart || '08:30';
  const pickupTimeEnd = formData?.pickupTimeEnd || '09:30';
  const returnTimeStart = formData?.returnTimeStart || '18:30';
  const returnTimeEnd = formData?.returnTimeEnd || '19:30';
  const pickupEndBounds = getPickupEndBounds(pickupTimeStart);
  const returnEndBounds = getReturnEndBounds(returnTimeStart);
  const daysError = errors?.pickupDays || errors?.returnDays;

  const sharedDays = fullWeekDays?.filter((day) => pickupDays?.includes(day) || returnDays?.includes(day));
  const pickupDaysKey = pickupDays?.filter((day) => fullWeekDays?.includes(day))?.join('|');
  const returnDaysKey = returnDays?.filter((day) => fullWeekDays?.includes(day))?.join('|');
  const sharedDaysKey = sharedDays?.join('|');

  useEffect(() => {
    if (pickupDaysKey !== sharedDaysKey) {
      updateFormData('pickupDays', sharedDays);
    }
    if (returnDaysKey !== sharedDaysKey) {
      updateFormData('returnDays', sharedDays);
    }
  }, [pickupDaysKey, returnDaysKey, sharedDaysKey, sharedDays, updateFormData]);

  useEffect(() => {
    if (!formData?.pickupTimeStart) updateFormData('pickupTimeStart', '08:30');
    if (!formData?.pickupTimeEnd) updateFormData('pickupTimeEnd', '09:30');
    if (!formData?.returnTimeStart) updateFormData('returnTimeStart', '18:30');
    if (!formData?.returnTimeEnd) updateFormData('returnTimeEnd', '19:30');
  }, [
    formData?.pickupTimeStart,
    formData?.pickupTimeEnd,
    formData?.returnTimeStart,
    formData?.returnTimeEnd,
    updateFormData
  ]);

  useEffect(() => {
    const updates = {};

    const normalizedPickupStart = clampTimeInRange(pickupTimeStart, '08:30', '23:59') || '08:30';
    if (normalizedPickupStart !== pickupTimeStart) {
      updates.pickupTimeStart = normalizedPickupStart;
    }

    const pickupBounds = getPickupEndBounds(normalizedPickupStart);
    const normalizedPickupEnd = clampTimeInRange(pickupTimeEnd, pickupBounds.min, pickupBounds.max) || pickupBounds.max;
    if (normalizedPickupEnd !== pickupTimeEnd) {
      updates.pickupTimeEnd = normalizedPickupEnd;
    }

    const normalizedReturnStart = clampTimeInRange(returnTimeStart, '00:00', '19:30') || '18:30';
    if (normalizedReturnStart !== returnTimeStart) {
      updates.returnTimeStart = normalizedReturnStart;
    }

    const returnBounds = getReturnEndBounds(normalizedReturnStart);
    const normalizedReturnEnd = clampTimeInRange(returnTimeEnd, returnBounds.min, returnBounds.max) || returnBounds.max;
    if (normalizedReturnEnd !== returnTimeEnd) {
      updates.returnTimeEnd = normalizedReturnEnd;
    }

    Object.entries(updates).forEach(([field, value]) => {
      updateFormData(field, value);
    });
  }, [
    pickupTimeStart,
    pickupTimeEnd,
    returnTimeStart,
    returnTimeEnd,
    updateFormData
  ]);

  const handleSharedDayToggle = (day) => {
    const nextDays = sharedDays?.includes(day)
      ? sharedDays?.filter((currentDay) => currentDay !== day)
      : fullWeekDays?.filter((weekDay) => weekDay === day || sharedDays?.includes(weekDay));

    updateFormData('pickupDays', nextDays);
    updateFormData('returnDays', nextDays);
  };

  const handleTimeChange = (field, value) => {
    if (!value) {
      updateFormData(field, value);
      return;
    }

    if (field === 'pickupTimeStart') {
      const safeStart = clampTimeInRange(value, '08:30', '23:59');
      const nextBounds = getPickupEndBounds(safeStart);
      const nextPickupEnd = clampTimeInRange(pickupTimeEnd, nextBounds.min, nextBounds.max);
      updateFormData('pickupTimeStart', safeStart);
      if (nextPickupEnd !== pickupTimeEnd) {
        updateFormData('pickupTimeEnd', nextPickupEnd || nextBounds.max);
      }
      return;
    }

    if (field === 'pickupTimeEnd') {
      const clampedEnd = clampTimeInRange(value, pickupEndBounds.min, pickupEndBounds.max);
      updateFormData('pickupTimeEnd', clampedEnd);
      return;
    }

    if (field === 'returnTimeStart') {
      const safeStart = clampTimeInRange(value, '00:00', '19:30');
      const nextBounds = getReturnEndBounds(safeStart);
      const nextReturnEnd = clampTimeInRange(returnTimeEnd, nextBounds.min, nextBounds.max);
      updateFormData('returnTimeStart', safeStart);
      if (nextReturnEnd !== returnTimeEnd) {
        updateFormData('returnTimeEnd', nextReturnEnd || nextBounds.max);
      }
      return;
    }

    if (field === 'returnTimeEnd') {
      const clampedEnd = clampTimeInRange(value, returnEndBounds.min, returnEndBounds.max);
      updateFormData('returnTimeEnd', clampedEnd);
      return;
    }

    updateFormData(field, value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Disponibilités</h2>
        <p className="text-sm text-muted-foreground">Indiquez les dates où votre matériel n'est pas disponible</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4 w-full max-w-[28rem]">
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

          <div className="grid grid-cols-7 gap-1">
            {weekDays?.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset })?.map((_, index) => (
              <div key={`empty-${index}`} className="h-10 w-10" />
            ))}

            {daysInMonth?.map((date) => {
              const isUnavailable = isDateUnavailable(date);
              const isToday = isSameDay(date, new Date());

              return (
                <button
                  key={date?.toISOString()}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  className={cn(
                    'h-10 w-10 mx-auto rounded-md text-sm font-medium transition-colors',
                    'hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-primary',
                    isUnavailable && 'bg-error/20 text-error line-through',
                    isToday && !isUnavailable && 'border-2 border-primary',
                    !isUnavailable && 'hover:bg-accent/10'
                  )}
                >
                  {format(date, 'd')}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-primary" />
              <span>Aujourd'hui</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-error/20 line-through" />
              <span>Indisponible</span>
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-surface rounded-lg border border-border p-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Horaires de récupération et restitution</h3>
            <p className="text-xs text-muted-foreground">
              Chaque plage horaire est limitée à 1 heure maximum. Récupération à partir de 08:30. Restitution au plus tard à 19:30.
            </p>
          </div>

          <div className={cn(
            'rounded-lg border border-border bg-background p-4 space-y-4',
            daysError && 'border-destructive'
          )}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Jours disponibles (communs)</label>
              <p className="text-xs text-muted-foreground">
                Les mêmes jours s'appliquent pour la récupération et la restitution.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fullWeekDays?.map((day) => (
                <div key={`shared-${day}`} className="flex items-center">
                  <Checkbox
                    label={day}
                    checked={sharedDays?.includes(day)}
                    onChange={() => handleSharedDayToggle(day)}
                  />
                </div>
              ))}
            </div>

            {daysError ? (
              <p className="text-sm text-destructive">{daysError}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-foreground">Plages horaires</label>
              <span className="text-xs text-muted-foreground">
                Un seul tableau avec 2 colonnes : récupération et restitution
              </span>
            </div>

            <div className="rounded-lg border border-border bg-background p-4 space-y-4">
              <div className="hidden md:grid md:grid-cols-[9rem_1fr_1fr] gap-4">
                <div />

                <div className="rounded-md border border-border bg-surface p-3">
                  <h4 className="text-sm font-semibold text-foreground">Récupération</h4>
                  <p className="text-xs text-muted-foreground mt-1">Remise du matériel</p>
                </div>

                <div className="rounded-md border border-border bg-surface p-3">
                  <h4 className="text-sm font-semibold text-foreground">Restitution</h4>
                  <p className="text-xs text-muted-foreground mt-1">Retour du matériel</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[9rem_1fr_1fr] gap-4 items-start">
                  <div className="text-sm font-medium text-foreground md:pt-2">Heure de début</div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground md:hidden">Récupération</p>
                    <Input
                      type="time"
                      value={pickupTimeStart}
                      onChange={(e) => handleTimeChange('pickupTimeStart', e?.target?.value)}
                      min="08:30"
                      aria-label="Heure de début de récupération"
                      error={errors?.pickupTimeStart}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground md:hidden">Restitution</p>
                    <Input
                      type="time"
                      value={returnTimeStart}
                      onChange={(e) => handleTimeChange('returnTimeStart', e?.target?.value)}
                      max="19:30"
                      aria-label="Heure de début de restitution"
                      error={errors?.returnTimeStart}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[9rem_1fr_1fr] gap-4 items-start">
                  <div className="text-sm font-medium text-foreground md:pt-2">Heure de fin</div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground md:hidden">Récupération</p>
                    <Input
                      type="time"
                      value={pickupTimeEnd}
                      onChange={(e) => handleTimeChange('pickupTimeEnd', e?.target?.value)}
                      min={pickupEndBounds.min}
                      max={pickupEndBounds.max}
                      aria-label="Heure de fin de récupération"
                      error={errors?.pickupTimeEnd}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground md:hidden">Restitution</p>
                    <Input
                      type="time"
                      value={returnTimeEnd}
                      onChange={(e) => handleTimeChange('returnTimeEnd', e?.target?.value)}
                      min={returnEndBounds.min}
                      max={returnEndBounds.max}
                      aria-label="Heure de fin de restitution"
                      error={errors?.returnTimeEnd}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>Récupération : fenêtre max 1h (ex. 08:30 à 09:30)</p>
                <p>Restitution : fenêtre max 1h et fin max 19:30 (ex. 18:30 à 19:30)</p>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-medium">Règles de retard</p>
                <p>
                  Si un rendez-vous est dépassé, la situation doit être signalée dans la réservation.
                </p>
                <p>
                  Les frais éventuels (retard, dépassement, non-restitution) ne sont pas appliqués automatiquement depuis cet écran.
                </p>
                <p>
                  Toute retenue de caution passe par le workflow officiel d'état des lieux, contestation et modération.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-border p-4">
        <Checkbox
          label="Désactiver temporairement l'annonce"
          description="Votre annonce ne sera pas visible tant que cette option est activée"
          checked={formData?.temporarilyDisabled}
          onChange={(e) => updateFormData('temporarilyDisabled', e?.target?.checked)}
        />
      </div>

      <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="Info" size={18} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Gestion des disponibilités</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Cliquez sur une date pour la marquer comme indisponible</li>
              <li>- Vous pouvez modifier les disponibilités à tout moment</li>
              <li>- Les réservations confirmées bloquent automatiquement les dates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisponibilitesStep;


