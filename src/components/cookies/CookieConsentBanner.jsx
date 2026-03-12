import React, { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Icon from '../AppIcon';
import { useCookieConsent } from '../../contexts/CookieConsentContext';

const CookieConsentBanner = () => {
  const { hasDecision, preferences, savePreferences, acceptAll, rejectNonEssential } = useCookieConsent();
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState(preferences);

  useEffect(() => {
    setDraftPreferences(preferences);
  }, [preferences]);

  if (hasDecision) {
    return null;
  }

  const togglePreference = (category) => {
    setDraftPreferences((previous) => ({
      ...previous,
      [category]: !previous?.[category]
    }));
  };

  const handleSaveCustomPreferences = () => {
    savePreferences(draftPreferences, 'banner_custom_preferences');
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-white/95 shadow-elevation-2 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-foreground">Gestion des cookies</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nous utilisons des cookies essentiels pour faire fonctionner la plateforme. Les cookies
              fonctionnels, analytiques et marketing sont optionnels.
            </p>
            <a
              href="/legal/politique-temoins-connexion"
              className="mt-2 inline-flex items-center gap-1 text-sm text-[#17a2b8] hover:underline"
            >
              Voir la politique cookies
              <Icon name="ExternalLink" size={14} />
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={rejectNonEssential}>
              Tout refuser
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsExpanded((previous) => !previous)}>
              {isExpanded ? 'Masquer options' : 'Personnaliser'}
            </Button>
            <Button size="sm" onClick={acceptAll}>
              Tout accepter
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">
              Choisissez les categories de cookies que vous acceptez.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>Essentiels</span>
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                  className="h-4 w-4 cursor-not-allowed rounded border-border text-[#17a2b8] opacity-50"
                />
              </label>

              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>Fonctionnels</span>
                <input
                  type="checkbox"
                  checked={draftPreferences?.functional}
                  onChange={() => togglePreference('functional')}
                  className="h-4 w-4 cursor-pointer rounded border-border text-[#17a2b8] focus:ring-[#17a2b8]"
                />
              </label>

              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>Analytiques</span>
                <input
                  type="checkbox"
                  checked={draftPreferences?.analytics}
                  onChange={() => togglePreference('analytics')}
                  className="h-4 w-4 cursor-pointer rounded border-border text-[#17a2b8] focus:ring-[#17a2b8]"
                />
              </label>

              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>Marketing</span>
                <input
                  type="checkbox"
                  checked={draftPreferences?.marketing}
                  onChange={() => togglePreference('marketing')}
                  className="h-4 w-4 cursor-pointer rounded border-border text-[#17a2b8] focus:ring-[#17a2b8]"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSaveCustomPreferences}>
                Enregistrer mes choix
              </Button>
              <Button variant="outline" size="sm" onClick={rejectNonEssential}>
                Uniquement essentiels
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieConsentBanner;
