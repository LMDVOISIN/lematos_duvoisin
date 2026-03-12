import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './AppIcon';
import FeedbackModal from './FeedbackModal';
import legalService from '../services/legalService';
import { DEFAULT_FOOTER_DATA, FOOTER_SLUG, parseFooterData } from '../utils/footerSettings';

const Footer = () => {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [footerData, setFooterData] = useState(DEFAULT_FOOTER_DATA);

  useEffect(() => {
    let active = true;

    const loadFooterData = async () => {
      try {
        const { data, error } = await legalService?.getLegalPage(FOOTER_SLUG);
        if (error) throw error;

        if (!active) return;
        setFooterData(parseFooterData(data?.content));
      } catch (error) {
        console.error('Erreur de chargement du footer public:', error);
        if (!active) return;
        setFooterData(DEFAULT_FOOTER_DATA);
      }
    };

    loadFooterData();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <footer className="relative mt-12 overflow-hidden bg-gradient-to-br from-[#0a365f] via-[#0f4d7a] to-[#0d7b88] text-white md:mt-16 lg:mt-20">
        <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#22d3ee]/25 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
          <div className="mb-4 md:hidden">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-gradient-to-r from-[#0f4d7a] to-[#0d7b88] px-3.5 py-2.5 text-white shadow-lg transition-all duration-300 ease-out active:scale-95"
              aria-label="Envoyer un feedback"
              onClick={() => setIsFeedbackModalOpen(true)}
            >
              <Icon name="Lightbulb" size={16} />
              <span className="text-sm font-semibold tracking-wide">Feedback</span>
            </button>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-[0_24px_70px_-35px_rgba(2,8,23,0.95)] backdrop-blur-xl md:p-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.1fr_1fr] md:gap-10">
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#bae6fd]">
                  Informations legales
                </h3>
                <ul className="space-y-2">
                  {footerData?.legalLinks?.map((link) => (
                    <li key={link?.to}>
                      <Link to={link?.to} className="group inline-flex items-center gap-2 text-sm text-white/85 transition-colors hover:text-white">
                        <Icon name="ChevronRight" size={14} className="text-[#7dd3fc] transition-transform group-hover:translate-x-0.5" />
                        {link?.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Link to="/" className="mb-4 inline-flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
                    <img
                      src="/assets/images/android-chrome-192x192-1771179342850.png"
                      alt="Logo Le Matos du Voisin"
                      className="h-9 w-9 object-contain"
                    />
                  </span>
                  <h3 className="text-xl font-semibold">{footerData?.companyName}</h3>
                </Link>

                <p className="max-w-sm text-sm leading-relaxed text-white/90">{footerData?.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <Icon name="ShieldCheck" size={13} className="text-[#7dd3fc]" />
                    Paiement sécurisé
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <Icon name="MapPin" size={13} className="text-[#7dd3fc]" />
                    Proche de chez vous
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <Icon name="CheckCircle2" size={13} className="text-[#7dd3fc]" />
                    Communauté vérifiée
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <Icon name="Shield" size={13} className="text-[#7dd3fc]" />
                    Litiges encadrés
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/80">
                  Workflow de caution, contestation et modération selon les conditions applicables.
                </p>
              </div>

              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#bae6fd]">
                  Catégories
                </h3>
                <ul className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-4">
                  {footerData?.categories?.map((category) => (
                    <li key={category}>
                      <Link
                        to={`/accueil-recherche?categorie=${encodeURIComponent(category)}`}
                        className="text-sm text-white/85 transition-colors hover:text-white"
                      >
                        {category}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/20 pt-5 text-center md:mt-10 md:flex-row md:text-left">
              <p className="text-sm text-white/85">
                © {new Date()?.getFullYear()} {footerData?.companyName}. Tous droits réservés.
              </p>
              <p className="text-sm text-white/90">{footerData?.bottomTagline}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="hidden fixed fab-mobile-safe z-30 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-white/30 bg-gradient-to-r from-[#0f4d7a] to-[#0d7b88] px-3.5 py-2.5 text-white shadow-2xl transition-all duration-300 ease-out hover:from-[#116192] hover:to-[#0f8f9d] active:scale-95 md:flex md:right-0 md:top-1/2 md:bottom-auto md:z-50 md:max-w-none md:-translate-y-1/2 md:translate-x-[72%] md:rounded-l-2xl md:rounded-r-none md:px-4 md:pr-5 md:pl-3 md:py-3 md:hover:translate-x-0 md:focus-visible:translate-x-0"
          aria-label="Envoyer un feedback"
          onClick={() => setIsFeedbackModalOpen(true)}
        >
          <Icon name="Lightbulb" size={18} />
          <span className="text-sm font-semibold tracking-wide">Feedback</span>
        </button>
      </footer>

      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
    </>
  );
};

export default Footer;

