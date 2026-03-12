import React, { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import ManagedLegalPage from '../../../components/legal/ManagedLegalPage';
import { useCookieConsent } from '../../../contexts/CookieConsentContext';

const CookiePreferencesPanel = () => {
  const { preferences, hasDecision, savePreferences, acceptAll, rejectNonEssential } = useCookieConsent();
  const [cookiePreferences, setCookiePreferences] = useState(preferences);

  useEffect(() => {
    setCookiePreferences(preferences);
  }, [preferences]);

  const togglePreference = (key) => {
    if (key === 'essential') return;
    setCookiePreferences((previous) => ({
      ...previous,
      [key]: !previous?.[key]
    }));
  };

  return (
    <section className="mt-8 rounded-lg border border-border bg-surface/50 p-5">
      <h2 className="text-lg font-semibold text-foreground mb-2">Gestion des cookies</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {hasDecision
          ? "Vos préférences actuelles sont enregistrées sur ce navigateur."
          : "Aucune préférence n'a encore été enregistrée sur ce navigateur."}
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2">
          <span className="text-sm text-foreground">Essentiels (obligatoires)</span>
          <input type="checkbox" checked={Boolean(cookiePreferences?.essential)} disabled />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2">
          <span className="text-sm text-foreground">Fonctionnels</span>
          <input
            type="checkbox"
            checked={Boolean(cookiePreferences?.functional)}
            onChange={() => togglePreference('functional')}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2">
          <span className="text-sm text-foreground">Analytiques</span>
          <input
            type="checkbox"
            checked={Boolean(cookiePreferences?.analytics)}
            onChange={() => togglePreference('analytics')}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2">
          <span className="text-sm text-foreground">Marketing</span>
          <input
            type="checkbox"
            checked={Boolean(cookiePreferences?.marketing)}
            onChange={() => togglePreference('marketing')}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => savePreferences(cookiePreferences, 'legal_page_custom_preferences')}>
          Enregistrer mes préférences
        </Button>
        <Button variant="outline" onClick={acceptAll}>
          Tout accepter
        </Button>
        <Button variant="outline" onClick={rejectNonEssential}>
          Tout refuser
        </Button>
      </div>
    </section>
  );
};

const PolitiqueCookies = () => {
  return (
    <ManagedLegalPage
      slug="politique-temoins-connexion"
      titleFallback="Politique cookies"
      fallbackSlugs={['politique-cookies', 'cookies']}
    >
      <CookiePreferencesPanel />
    </ManagedLegalPage>
  );
};

export default PolitiqueCookies;
