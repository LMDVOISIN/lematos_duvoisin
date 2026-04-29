import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import AuthTabs from './components/AuthTabs';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import SocialAuth from './components/SocialAuth';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import Footer from '../../components/Footer';
import { ActionCard } from '../../components/page/ActionPageLayout';
import { useAuth } from '../../contexts/AuthContext';

const AUTH_QUICK_STEPS = [
  {
    icon: 'LogIn',
    title: '1. Entrer',
    description: 'Connexion ou inscription, au plus simple.'
  },
  {
    icon: 'Search',
    title: '2. Avancer',
    description: 'Reprendre une reservation, publier ou louer.'
  },
  {
    icon: 'ShieldCheck',
    title: '3. Continuer',
    description: 'Votre parcours repart tout de suite au bon endroit.'
  }
];

const Authentication = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('connexion');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  const redirectAfterAuth =
    typeof location?.state?.from === 'string' &&
    location?.state?.from?.startsWith('/') &&
    location?.state?.from !== '/authentification'
      ? location?.state?.from
      : '/accueil-recherche';

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Connexion & Inscription - Le Matos Du Voisin</title>
          <meta name="description" content="Chargement de la session utilisateur" />
        </Helmet>
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eef8ff_0%,#f7fbff_100%)] px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <Icon name="Loader2" size={24} className="animate-spin text-primary" />
            </div>
            <p className="text-sm text-slate-600">Chargement...</p>
          </div>
        </div>
      </>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectAfterAuth} replace />;
  }

  return (
    <>
      <Helmet>
        <title>Connexion & Inscription - Le Matos Du Voisin</title>
        <meta
          name="description"
          content="Connectez-vous ou creez votre compte pour louer du materiel entre voisins en toute securite"
        />
      </Helmet>

      <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#eef8ff_0%,#f7fbff_100%)]">
        <main className="relative flex-1 overflow-hidden px-4 pb-10 pt-6 md:px-6 md:pt-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(255,236,168,0.42),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(184,230,255,0.34),_transparent_30%),radial-gradient(circle_at_center,_rgba(219,245,238,0.38),_transparent_44%)]"
          />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
            <Link to="/accueil-recherche" className="inline-flex items-center gap-3 self-start rounded-full border border-white/70 bg-white/85 px-4 py-2 shadow-sm">
              <img
                src="/assets/images/android-chrome-192x192-1771179342850.png"
                alt="Logo Le Matos Du Voisin"
                className="h-10 w-10 object-contain"
              />
              <span className="text-sm font-semibold text-slate-950 md:text-base">Le Matos Du Voisin</span>
            </Link>

            <div className="grid gap-6 lg:grid-cols-[minmax(420px,500px)_minmax(0,1fr)] lg:items-start">
              <ActionCard className="rounded-[32px] border-white/80 bg-white/94 p-6 md:p-8">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Connexion</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">Inscription</span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Acces rapide</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-slate-950">Entrez ici</h2>
                      <p className="mt-1 text-sm text-slate-600">Choisissez votre mode, puis avancez.</p>
                    </div>
                  </div>

                  <SocialAuth />

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        ou avec votre e-mail
                      </span>
                    </div>
                  </div>

                  <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />

                  {activeTab === 'connexion' ? (
                    <LoginForm onForgotPassword={() => setShowForgotPassword(true)} />
                  ) : (
                    <RegisterForm />
                  )}
                </div>
              </ActionCard>

              <section className="space-y-5">
                <div className="inline-flex rounded-full border border-white/70 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f7081]">
                  Connexion simple
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                    Entrez, puis reprenez votre parcours tout de suite
                  </h1>
                  <p className="max-w-xl text-sm text-slate-600 md:text-base">
                    Ici, une seule chose compte: vous connecter vite pour louer, publier ou reprendre une reservation.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {AUTH_QUICK_STEPS?.map((item) => (
                    <ActionCard key={item?.title} className="rounded-3xl border-white/80 bg-white/88 p-4 md:p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                        <Icon name={item?.icon} size={18} />
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-950">{item?.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item?.description}</p>
                    </ActionCard>
                  ))}
                </div>

                <ActionCard className="rounded-[28px] border-emerald-200/80 bg-emerald-50/80 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                      <Icon name="ShieldCheck" size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">A retenir</p>
                      <p className="mt-1 text-sm text-emerald-900">
                        Une fois connecte, vous repartez directement vers la bonne page.
                      </p>
                    </div>
                  </div>
                </ActionCard>
              </section>
            </div>

            <p className="mx-auto max-w-2xl text-center text-xs text-slate-500 md:text-sm">
              En vous connectant, vous acceptez nos{' '}
              <a href="/legal/cgu" className="text-primary hover:underline">
                Conditions d'utilisation
              </a>{' '}
              et notre{' '}
              <a href="/legal/politique-confidentialite" className="text-primary hover:underline">
                Politique de confidentialite
              </a>
              .
            </p>
          </div>
        </main>

        <Footer />
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
};

export default Authentication;
