import React, { useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '../../../utils/cn';

const SYSTEM_OPTIONS = ['Windows', 'Mac', 'Linux'];
const SCREEN_OPTIONS = [
  { value: 'Desktop', icon: Monitor, label: 'Ordinateur' },
  { value: 'Tablet', icon: Tablet, label: 'Tablette' },
  { value: 'Mobile', icon: Smartphone, label: 'Mobile' }
];
const BROWSER_OPTIONS = ['Chrome', 'Firefox', 'Safari', 'Edge'];

const baseChoiceClassName = 'rounded-[24px] border-2 border-slate-200 bg-white text-slate-900 transition-all duration-200 hover:border-slate-300';
const selectedChoiceClassName = 'border-primary bg-blue-50 text-primary shadow-[0_8px_24px_rgba(59,130,246,0.12)]';

const TesterOnboarding = ({
  onComplete,
  initialContext = {},
  submitting = false,
  fullscreen = true,
  outerClassName = '',
  cardClassName = ''
}) => {
  const [system, setSystem] = useState(initialContext?.system || '');
  const [screenType, setScreenType] = useState(initialContext?.screenType || '');
  const [browser, setBrowser] = useState(initialContext?.browser || '');
  const [localSubmitting, setLocalSubmitting] = useState(false);

  useEffect(() => {
    setSystem(initialContext?.system || '');
    setScreenType(initialContext?.screenType || '');
    setBrowser(initialContext?.browser || '');
  }, [initialContext?.browser, initialContext?.screenType, initialContext?.system]);

  const isComplete = Boolean(system && screenType && browser);
  const isSubmitting = submitting || localSubmitting;

  const containerClassName = useMemo(() => cn(
    fullscreen
      ? 'min-h-screen app-page-gradient flex items-center justify-center p-4'
      : 'app-page-gradient px-4 py-10 md:px-6 md:py-16',
    outerClassName
  ), [fullscreen, outerClassName]);

  const cardClasses = useMemo(() => cn(
    'mx-auto w-full max-w-[1000px] rounded-[30px] bg-white px-6 py-8 shadow-elevation-4 sm:px-10 sm:py-10 md:px-12 md:py-12',
    cardClassName
  ), [cardClassName]);

  const getChoiceClassName = (isSelected, tall = false) => cn(
    baseChoiceClassName,
    tall ? 'min-h-[126px] px-4 py-6' : 'min-h-[78px] px-4 py-5',
    isSelected ? selectedChoiceClassName : ''
  );

  const handleSubmit = async () => {
    if (!isComplete || !onComplete || isSubmitting) return;

    try {
      setLocalSubmitting(true);
      await onComplete({ system, screenType, browser });
    } finally {
      setLocalSubmitting(false);
    }
  };

  return (
    <div className={containerClassName}>
      <div className={cardClasses}>
        <h2 className="mb-3 text-3xl font-bold tracking-tight text-slate-950 md:text-[3rem]">
          Bienvenue participant !
        </h2>
        <p className="mb-10 text-lg leading-relaxed text-slate-600 md:text-[1.95rem] md:leading-[1.25]">
          Avant de commencer, merci de renseigner votre contexte d'essai :
        </p>

        <div className="space-y-10">
          <div>
            <label className="mb-4 block text-base font-medium text-slate-800 md:text-[1.1rem]">
              Systeme d'exploitation
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              {SYSTEM_OPTIONS.map((os) => (
                <button
                  key={os}
                  type="button"
                  onClick={() => setSystem(os)}
                  className={getChoiceClassName(system === os)}
                >
                  <span className="text-2xl font-medium md:text-[2rem]">{os}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-4 block text-base font-medium text-slate-800 md:text-[1.1rem]">
              Type d'ecran
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              {SCREEN_OPTIONS.map(({ value, icon: ScreenIcon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScreenType(value)}
                  className={cn(
                    getChoiceClassName(screenType === value, true),
                    'flex flex-col items-center justify-center gap-3'
                  )}
                >
                  <ScreenIcon className="h-8 w-8 md:h-10 md:w-10" strokeWidth={1.8} />
                  <span className="text-2xl font-medium md:text-[2rem]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-4 block text-base font-medium text-slate-800 md:text-[1.1rem]">
              Navigateur
            </label>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {BROWSER_OPTIONS.map((browserName) => (
                <button
                  key={browserName}
                  type="button"
                  onClick={() => setBrowser(browserName)}
                  className={getChoiceClassName(browser === browserName)}
                >
                  <span className="text-2xl font-medium md:text-[2rem]">{browserName}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete || isSubmitting}
            className={cn(
              'mt-2 w-full rounded-[24px] px-6 py-5 text-2xl font-medium transition-colors md:text-[2rem]',
              isComplete && !isSubmitting
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-slate-200 text-white'
            )}
          >
            {isSubmitting ? 'Enregistrement...' : 'Commencer les essais'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TesterOnboarding;
