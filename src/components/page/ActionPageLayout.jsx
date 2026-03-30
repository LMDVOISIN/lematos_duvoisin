import React from 'react';
import Header from '../navigation/Header';
import Footer from '../Footer';
import Icon from '../AppIcon';
import { cn } from '../../utils/cn';

const HERO_TONES = {
  sky: {
    shell: 'border-[#bfe5ff] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,250,255,0.96))]',
    glow: 'from-[#fff1a8]/55 via-[#cfeeff]/45 to-[#d9f7f0]/45',
    pill: 'border-[#cfe7fb] bg-white/85 text-[#0f6070]',
    aside: 'border-[#cfe7fb] bg-white/82'
  },
  warm: {
    shell: 'border-[#f4dcc3] bg-[linear-gradient(135deg,rgba(255,251,244,0.97),rgba(255,244,230,0.95))]',
    glow: 'from-[#ffe0b8]/60 via-[#fff4d3]/35 to-[#dff7ec]/30',
    pill: 'border-[#f3dcc4] bg-white/85 text-[#8c4b21]',
    aside: 'border-[#f3dcc4] bg-white/80'
  },
  mint: {
    shell: 'border-[#c9eadf] bg-[linear-gradient(135deg,rgba(247,255,252,0.97),rgba(236,252,246,0.95))]',
    glow: 'from-[#d7f4e4]/55 via-[#fff7cf]/30 to-[#d7ecff]/30',
    pill: 'border-[#d7ecdf] bg-white/85 text-[#14644a]',
    aside: 'border-[#d7ecdf] bg-white/82'
  }
};

const STEP_STATE_STYLES = {
  done: {
    card: 'border-emerald-200 bg-emerald-50/90',
    icon: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700'
  },
  active: {
    card: 'border-sky-200 bg-sky-50/95',
    icon: 'bg-white text-sky-700',
    text: 'text-sky-700'
  },
  warning: {
    card: 'border-rose-200 bg-rose-50/95',
    icon: 'bg-white text-rose-700',
    text: 'text-rose-700'
  },
  upcoming: {
    card: 'border-slate-200 bg-slate-50/90',
    icon: 'bg-white text-slate-400',
    text: 'text-slate-500'
  }
};

export const ActionPageShell = ({
  children,
  hero = null,
  maxWidth = 'max-w-6xl',
  containerClassName,
  pageClassName,
  mainClassName,
  footer = true
}) => {
  const shouldRenderHero = Boolean(hero) && !(
    React.isValidElement(hero) && hero.type === ActionHero
  );

  return (
    <div className={cn('min-h-screen flex flex-col bg-[#f3fbff]', pageClassName)}>
      <Header />
      <main className={cn('relative flex-1 overflow-hidden pb-12 pt-24 md:pt-28', mainClassName)}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(255,240,160,0.36),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(167,222,255,0.3),_transparent_30%),radial-gradient(circle_at_center,_rgba(219,245,238,0.42),_transparent_44%)]"
        />
        <div className={cn('relative mx-auto w-full px-4 sm:px-6 lg:px-8', maxWidth, containerClassName)}>
          {shouldRenderHero ? <div className="mb-6 md:mb-8">{hero}</div> : null}
          <div className="space-y-6">{children}</div>
        </div>
      </main>
      {footer ? <Footer /> : null}
    </div>
  );
};

export const ActionPill = ({ icon, children, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.04em]',
      className
    )}
  >
    {icon ? <Icon name={icon} size={14} /> : null}
    <span>{children}</span>
  </span>
);

export const ActionHero = ({
  eyebrow,
  title,
  subtitle,
  pills = [],
  actions = null,
  stats = [],
  aside = null,
  tone = 'sky',
  className
}) => null;

export const ActionStat = ({ label, value, helper, icon, tone = 'sky' }) => {
  const tones = {
    sky: 'bg-sky-50 text-sky-700',
    mint: 'bg-emerald-50 text-emerald-700',
    warm: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
    rose: 'bg-rose-50 text-rose-700'
  };

  return (
    <div className="rounded-3xl border border-white/70 bg-white/88 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        {icon ? (
          <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', tones?.[tone] || tones.sky)}>
            <Icon name={icon} size={18} />
          </span>
        ) : null}
      </div>
    </div>
  );
};

export const ActionCard = ({ children, className }) => (
  <div className={cn('rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-[0_22px_48px_-38px_rgba(15,77,122,0.6)] md:p-6', className)}>
    {children}
  </div>
);

export const ActionEmptyState = ({ icon = 'Sparkles', title, description, action = null, className }) => (
  <ActionCard className={cn('py-10 text-center', className)}>
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-700">
      <Icon name={icon} size={30} />
    </div>
    <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
    {description ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p> : null}
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
  </ActionCard>
);

export const ActionStepRail = ({ eyebrow = 'Points utiles', title = 'A savoir', items = [] }) => (
  <div className="space-y-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2>
    </div>

    <div className="space-y-3">
      {items?.map((item, index) => {
        const state = STEP_STATE_STYLES?.[item?.state] || STEP_STATE_STYLES.upcoming;
        return (
          <div key={`${item?.title || 'step'}-${index}`} className={cn('rounded-3xl border p-4', state.card)}>
            <div className="flex items-start gap-3">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm', state.icon)}>
                <Icon name={item?.icon || 'Circle'} size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{item?.title}</p>
                {item?.description ? <p className={cn('mt-1 text-sm font-medium', state.text)}>{item?.description}</p> : null}
                {item?.helper ? <p className="mt-1 text-xs text-slate-500">{item?.helper}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
