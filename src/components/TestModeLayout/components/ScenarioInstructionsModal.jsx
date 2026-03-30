import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  canOpenScenarioPathDirectly,
  resolveScenarioPath
} from '../../../utils/testScenarioPaths';
import { getTestingScenarioBrief } from '../../../utils/testingScenarioBriefs';

const ScenarioInstructionsModal = ({
  scenario,
  currentPath,
  sessionRole,
  referenceScenario,
  testerOrderIndex,
  hasExistingListings,
  expectationText,
  expectationSaved,
  visitedPages,
  mirrorGuidance,
  isOpen,
  readOnly = false,
  onClose,
  onCompleteScenario,
  onGoToPage,
  onSaveExpectation
}) => {
  const navigate = useNavigate();
  const [expectationDraft, setExpectationDraft] = useState(expectationText || '');
  const [savingExpectation, setSavingExpectation] = useState(false);
  const [localSaved, setLocalSaved] = useState(Boolean(expectationSaved));

  const pages = Array.isArray(scenario?.pages) ? scenario.pages : [];
  const sortedPages = [...pages].sort((a, b) => (a?.order || 0) - (b?.order || 0));
  const requiredPages = sortedPages.filter((page) => page?.required);
  const completedPages = sortedPages.filter((page) => visitedPages?.includes(page?.url));
  const completedRequired = requiredPages.filter((page) => visitedPages?.includes(page?.url));
  const hasRequiredPages = requiredPages.length > 0;
  const completedSteps = hasRequiredPages ? completedRequired.length : completedPages.length;
  const canComplete = hasRequiredPages
    ? completedRequired.length === requiredPages.length
    : completedPages.length > 0;
  const nextPage = sortedPages.find((page) => !visitedPages?.includes(page?.url)) || null;
  const hasActionableNextPage = Boolean(nextPage && canOpenScenarioPathDirectly(nextPage?.url));
  const mirrorListings = Array.isArray(mirrorGuidance?.listings)
    ? mirrorGuidance.listings.filter((listing) => String(listing?.actionPath || '').trim())
    : [];
  const scenarioBrief = getTestingScenarioBrief(scenario, {
    viewerRole: sessionRole,
    mirrorGuidance,
    testerOrderIndex,
    hasExistingListings
  });
  const referenceScenarioBrief = sessionRole === 'mirror' && referenceScenario
    ? getTestingScenarioBrief(referenceScenario, {
      viewerRole: 'reference',
      testerOrderIndex,
      hasExistingListings
    })
    : null;
  const isEntryBlocked = Boolean(scenarioBrief?.isStartBlocked);
  const requiresExpectation = !isEntryBlocked && !readOnly;
  const canDismiss = readOnly || !requiresExpectation || localSaved;
  const hasStartedScenario = completedSteps > 0;
  const hasPrerequisiteDetails = Boolean(
    !isEntryBlocked
    && String(scenarioBrief?.prerequisite || '').trim()
    && String(scenarioBrief?.prerequisite || '').trim() !== String(scenarioBrief?.firstAction || '').trim()
  );
  const commonReminderItems = [
    scenarioBrief?.participantImportant,
    "Le rythme du test dépend parfois de l'autre testeur. Il est normal d'attendre à certaines étapes le temps qu'il avance lui aussi.",
    "À tout moment, vous pouvez demander de l'aide à l'observateur via le pictogramme rond et jaune en bas à droite."
  ].filter(Boolean);

  useEffect(() => {
    setExpectationDraft(expectationText || '');
    setLocalSaved(Boolean(expectationSaved));
  }, [expectationText, expectationSaved, isOpen]);

  if (!isOpen || !scenario) {
    return null;
  }

  const handleExpectationSave = async () => {
    const payload = String(expectationDraft || '').trim();
    if (!payload || savingExpectation) return;
    setSavingExpectation(true);
    const ok = await onSaveExpectation?.(payload);
    setSavingExpectation(false);
    if (ok) {
      setLocalSaved(true);
    }
  };

  const handleListingOpen = (listingPath) => {
    if (!listingPath) return;
    if (requiresExpectation && !localSaved) return;
    onClose?.();
    navigate(listingPath);
  };

  const handleNextStep = () => {
    if (!nextPage || typeof onGoToPage !== 'function') return;
    if (requiresExpectation && !localSaved) return;
    onClose?.();
    onGoToPage(nextPage);
  };

  const handleComplete = () => {
    if (requiresExpectation && !localSaved) return;
    onClose?.();
    onCompleteScenario?.();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 lg:px-6">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isEntryBlocked
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-blue-100 text-blue-900'
              }`}>
                {isEntryBlocked ? 'En attente' : 'Consigne'}
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-tight text-slate-950">
              {scenarioBrief?.participantTitle}
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              {isEntryBlocked
                ? "Ce parcours n'est pas encore prêt. Revenez ici quand la préparation sera terminée."
                : readOnly
                  ? 'Aperçu administrateur de la consigne affichée au testeur.'
                  : 'Lisez la situation, reformulez les consignes avec vos mots, puis commencez le test.'}
            </p>
          </div>

          <button
            type="button"
            onClick={canDismiss ? onClose : undefined}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-slate-500 transition-colors ${
              canDismiss
                ? 'border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                : 'cursor-not-allowed border-slate-100 text-slate-300'
            }`}
            aria-label="Fermer la consigne"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4 lg:px-6 lg:py-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-5">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1.5 text-sm font-semibold text-slate-900">La situation</p>
                <p className="text-sm leading-6 text-slate-800">
                  {scenarioBrief?.participantSituation}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-1.5 text-sm font-semibold text-slate-900">Votre objectif</p>
                <p className="text-sm leading-6 text-slate-800">
                  {scenarioBrief?.participantGoal}
                </p>
              </div>

              {isEntryBlocked ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-1.5 text-sm font-semibold text-amber-950">Avant de pouvoir continuer</p>
                  <p className="text-sm leading-6 text-amber-900">
                    {scenarioBrief?.prerequisite || 'Ce parcours attend encore la préparation nécessaire.'}
                  </p>
                  {scenarioBrief?.firstAction && (
                    <p className="mt-2.5 text-sm leading-6 text-amber-900">
                      <span className="font-semibold">Que faire maintenant :</span>{' '}
                      {scenarioBrief?.firstAction}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  {hasPrerequisiteDetails ? (
                    <>
                      <p className="mb-1.5 text-sm font-semibold text-slate-900">Avant de commencer</p>
                      <p className="text-sm leading-6 text-slate-800">
                        {scenarioBrief?.prerequisite}
                      </p>
                      <p className="mt-3 mb-1.5 text-sm font-semibold text-slate-900">Puis commencez par</p>
                      <p className="text-sm leading-6 text-slate-800">
                        {scenarioBrief?.firstAction || 'Commencez sur le premier écran repéré du parcours.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-1.5 text-sm font-semibold text-slate-900">Commencez par</p>
                      <p className="text-sm leading-6 text-slate-800">
                        {scenarioBrief?.firstAction || 'Commencez sur le premier écran repéré du parcours.'}
                      </p>
                    </>
                  )}
                </div>
              )}

              {(mirrorListings.length > 0 || referenceScenarioBrief) && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-1.5 text-sm font-semibold text-emerald-950">Pour ce binôme</p>

                  {referenceScenarioBrief?.participantTitle && (
                    <div className="mb-3 rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-900/80">
                        Parcours lancé par l'autre testeur
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-950">
                        {referenceScenarioBrief.participantTitle}
                      </p>
                    </div>
                  )}

                  {mirrorListings.length > 0 && (
                    <>
                      <p className="mb-3 text-sm leading-6 text-emerald-900">
                        Utilisez uniquement l'annonce préparée pour ce test.
                      </p>

                      <div className="space-y-2">
                        {mirrorListings.map((listing, index) => {
                          const listingPath = resolveScenarioPath(listing?.actionPath || '');
                          const isCurrentListing = Boolean(listingPath && listingPath === currentPath);

                          if (readOnly) {
                            return (
                              <div
                                key={`${listing?.listingId || listing?.title || 'listing'}-${index}`}
                                className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left text-sm text-slate-900"
                              >
                                <span className="block font-semibold">
                                  {listing?.title || 'Annonce du test'}
                                </span>
                                <span className="mt-1 block text-xs text-slate-600">
                                  Annonce préparée pour ce test
                                </span>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={`${listing?.listingId || listing?.title || 'listing'}-${index}`}
                              type="button"
                              onClick={() => handleListingOpen(listingPath)}
                              disabled={!listingPath || isCurrentListing}
                              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                                isCurrentListing
                                  ? 'cursor-default border-emerald-200 bg-white text-emerald-800'
                                  : 'border-emerald-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-100'
                              }`}
                            >
                              <span className="block font-semibold">
                                {listing?.title || 'Annonce du test'}
                              </span>
                              <span className="mt-1 block text-xs text-slate-600">
                                {isCurrentListing ? 'Annonce déjà ouverte' : 'Ouvrir cette annonce'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {commonReminderItems.length > 0 && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-1.5 text-sm font-semibold text-blue-950">À savoir</p>
                  <div className="space-y-2 text-[13px] leading-5 text-blue-900">
                    {commonReminderItems.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              )}

              {requiresExpectation && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900">
                    Avant de commencer et pour une compréhension optimale, reformulez les consignes avec vos mots.
                  </p>
                  <textarea
                    value={expectationDraft}
                    onChange={(event) => {
                      setExpectationDraft(event?.target?.value || '');
                      if (localSaved) setLocalSaved(false);
                    }}
                    rows={4}
                    className="min-h-[124px] w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-300 focus:outline-none"
                    placeholder="Exemple : Je dois annuler une réservation déjà planifiée, comprendre l'impact pour le locataire et retrouver rapidement l'action à faire."
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {localSaved
                        ? 'Votre reformulation est enregistrée. Vous pouvez encore la modifier si besoin.'
                        : 'Merci de reformuler les consignes avant de commencer.'}
                    </span>
                    <button
                      type="button"
                      onClick={handleExpectationSave}
                      disabled={!String(expectationDraft || '').trim() || savingExpectation}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {savingExpectation ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 lg:px-6">
          {!readOnly && !isEntryBlocked && hasActionableNextPage && (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!localSaved}
              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-900 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {hasStartedScenario ? 'Continuer' : 'Commencer'}
            </button>
          )}

          {!readOnly && !isEntryBlocked && canComplete && !hasActionableNextPage && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={!localSaved}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Ouvrir le compte rendu
            </button>
          )}

          <button
            type="button"
            onClick={canDismiss ? onClose : undefined}
            className={`rounded-xl border bg-white px-4 py-2 text-sm font-medium transition-colors ${
              canDismiss
                ? 'border-slate-200 text-slate-900 hover:bg-slate-100'
                : 'cursor-not-allowed border-slate-100 text-slate-300'
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioInstructionsModal;

