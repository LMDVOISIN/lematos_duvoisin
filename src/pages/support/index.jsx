import React, { useEffect } from 'react';

const CHATBOT_OPEN_EVENT = 'ldv:chatbot-open';

function openSupportChat() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHATBOT_OPEN_EVENT));
}

const SupportPage = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const timerId = window.setTimeout(() => {
      openSupportChat();
    }, 150);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef6ff_0%,#f7fbff_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-[#b7dbe7] bg-white shadow-[0_24px_70px_rgba(15,77,122,0.10)]">
          <div className="bg-[linear-gradient(135deg,#0f7081_0%,#1598ab_100%)] px-6 py-8 text-white sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/80">Assistance</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Besoin d'aide ?</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/90">
              L'assistance Le Matos Du Voisin se fait principalement via le chat integre au site et a l'application.
            </p>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-8">
            <section className="rounded-[28px] border border-[#d4e8f0] bg-[#f5fbfd] p-6">
              <h2 className="text-xl font-semibold text-slate-900">Ouvrir le chat</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Le chat d'assistance s'ouvre automatiquement sur cette page. Si besoin, tu peux aussi l'ouvrir
                manuellement avec le bouton en bas a droite.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openSupportChat}
                  className="inline-flex items-center justify-center rounded-full bg-[#0f7081] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0d6270]"
                >
                  Ouvrir le chat d'assistance
                </button>
                <a
                  href="mailto:contact@lematosduvoisin.fr"
                  className="inline-flex items-center justify-center rounded-full border border-[#0f7081]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0f7081] transition hover:border-[#0f7081]/40 hover:bg-[#eef8fb]"
                >
                  contact@lematosduvoisin.fr
                </a>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-[24px] border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">Depuis l'application</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Ouvre l'app, puis utilise le chat d'assistance present dans l'interface.
                </p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">Depuis le site</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Le bouton de chat en bas a droite permet de poser une question sur les usages publics de la plateforme.
                </p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">Ressources utiles</h2>
                <div className="mt-3 space-y-2 text-sm">
                  <a href="/foire-questions" className="block text-[#0f7081] hover:underline">
                    Consulter la FAQ
                  </a>
                  <a href="/legal/politique-confidentialite" className="block text-[#0f7081] hover:underline">
                    Politique de confidentialite
                  </a>
                  <a href="/legal/mentions-legales" className="block text-[#0f7081] hover:underline">
                    Mentions legales
                  </a>
                </div>
              </article>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
};

export default SupportPage;
