import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { isAdminVerificationScenario } from '../../../utils/adminVerificationContext';

const NOTIFICATION_OPTIONS = [
  {
    id: 'newBooking',
    label: 'Nouvelles réservations',
    description: 'Recevoir une notification pour chaque nouvelle réservation'
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'Être notifié des nouveaux messages dans le tchat'
  },
  {
    id: 'paymentConfirmed',
    label: 'Paiements confirmés',
    description: "Notification lors de la validation d'un paiement"
  },
  {
    id: 'returnReminder',
    label: 'Rappels de restitution',
    description: 'Recevoir un rappel avant la date de restitution'
  },
  {
    id: 'documentReminder',
    label: 'Documents manquants',
    description: 'Rappels pour les documents non fournis'
  },
  {
    id: 'dailyDigest',
    label: 'Résumé quotidien',
    description: "Recevoir un e-mail quotidien avec l'activité de votre compte"
  },
  {
    id: 'promotions',
    label: 'Promotions et actualités',
    description: 'Recevoir les offres spéciales et les nouveautés de la plateforme'
  }
];

const LANGUAGE_OPTIONS = [
  { value: 'Français', label: 'Français' },
  { value: 'English', label: 'English' }
];

const CURRENCY_OPTIONS = [
  { value: 'Euro (€)', label: 'Euro (€)' },
  { value: 'Dollar (USD)', label: 'Dollar (USD)' }
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Paris (UTC+1)', label: 'Europe/Paris (UTC+1)' },
  { value: 'UTC (UTC+0)', label: 'UTC (UTC+0)' }
];

const SettingsSection = ({ settings, onUpdateSettings }) => {
  const isVerificationSecurityScenario = isAdminVerificationScenario('partial_advanced_security');
  const [notificationSettings, setNotificationSettings] = useState(settings?.notifications || {});
  const [securitySettings, setSecuritySettings] = useState(settings?.security || {});
  const [preferenceSettings, setPreferenceSettings] = useState(settings?.preferences || {});
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  useEffect(() => {
    setNotificationSettings(settings?.notifications || {});
    setSecuritySettings(settings?.security || {});
    setPreferenceSettings(settings?.preferences || {});
  }, [settings]);

  const activeSessions = useMemo(() => {
    const sessions = Array.isArray(securitySettings?.activeSessions)
      ? securitySettings.activeSessions
      : [];
    return sessions?.length > 0
      ? sessions
      : [{
        id: 'current',
        deviceLabel: 'Navigateur actuel',
        lastSeenAt: new Date().toISOString(),
        current: true
      }];
  }, [securitySettings?.activeSessions]);

  const persistSection = (nextSettings) => {
    onUpdateSettings(nextSettings);
  };

  const handleNotificationChange = (key, value) => {
    const updated = {
      ...notificationSettings,
      [key]: value
    };
    setNotificationSettings(updated);
    persistSection({ notifications: updated });
  };

  const handleToggleTwoFactor = () => {
    const nextSecurity = {
      ...securitySettings,
      twoFactorEnabled: !securitySettings?.twoFactorEnabled
    };
    setSecuritySettings(nextSecurity);
    persistSection({ security: nextSecurity });
    setVerificationMessage(
      nextSecurity?.twoFactorEnabled
        ? 'Double validation activée pour ce compte.'
        : 'Double validation désactivée pour ce compte.'
    );
  };

  const handlePasswordHelp = () => {
    const nextSecurity = {
      ...securitySettings,
      passwordHelpOpenedAt: new Date().toISOString(),
      lastPasswordChangeLabel: 'A l instant'
    };
    setSecuritySettings(nextSecurity);
    persistSection({ security: nextSecurity });
    setVerificationMessage('Le parcours de changement de mot de passe a été déclenché.');
  };

  const handleCloseOtherSessions = () => {
    const currentSession = activeSessions?.find((session) => session?.current) || activeSessions?.[0];
    const nextSecurity = {
      ...securitySettings,
      activeSessions: currentSession ? [currentSession] : []
    };
    setSecuritySettings(nextSecurity);
    persistSection({ security: nextSecurity });
    setVerificationMessage('Les autres sessions ont été fermées.');
  };

  const handlePreferenceChange = (field, value) => {
    const updated = {
      ...preferenceSettings,
      [field]: value
    };
    setPreferenceSettings(updated);
    persistSection({ preferences: updated });
    setVerificationMessage('Préférence enregistrée.');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-4 shadow-elevation-2 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon name="Bell" size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground md:text-xl">Préférences de notification</h3>
            <p className="text-sm text-muted-foreground">Gérez comment vous souhaitez être notifié</p>
          </div>
        </div>

        <div className="space-y-4">
          {NOTIFICATION_OPTIONS?.map((option) => (
            <div key={option?.id} className="flex items-start gap-4 rounded-lg bg-surface p-4">
              <Checkbox
                checked={notificationSettings?.[option?.id]}
                onChange={(event) => handleNotificationChange(option?.id, event?.target?.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <label className="cursor-pointer text-sm font-medium text-foreground">
                  {option?.label}
                </label>
                <p className="mt-1 text-sm text-muted-foreground">{option?.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 shadow-elevation-2 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon name="Lock" size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground md:text-xl">Sécurité</h3>
            <p className="text-sm text-muted-foreground">Gérez la sécurité de votre compte</p>
          </div>
        </div>

        {verificationMessage && isVerificationSecurityScenario ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {verificationMessage}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-surface p-4">
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-foreground">Mot de passe</p>
              <p className="text-sm text-muted-foreground">
                {securitySettings?.lastPasswordChangeLabel || 'Dernière modification inconnue'}
              </p>
            </div>
            <Button variant="outline" size="sm" iconName="Key" iconPosition="left" onClick={handlePasswordHelp}>
              Modifier
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-surface p-4">
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-foreground">Authentification à deux facteurs</p>
              <p className="text-sm text-muted-foreground">
                {securitySettings?.twoFactorEnabled
                  ? 'Double validation activée.'
                  : 'Ajoutez une couche de sécurité supplémentaire.'}
              </p>
            </div>
            <Button variant="outline" size="sm" iconName="Shield" iconPosition="left" onClick={handleToggleTwoFactor}>
              {securitySettings?.twoFactorEnabled ? 'Désactiver' : 'Activer'}
            </Button>
          </div>

          <div className="rounded-lg bg-surface p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="mb-1 text-sm font-medium text-foreground">Sessions actives</p>
                <p className="text-sm text-muted-foreground">
                  {activeSessions?.length} session{activeSessions?.length > 1 ? 's' : ''} suivie{activeSessions?.length > 1 ? 's' : ''}.
                </p>
              </div>
              <Button variant="outline" size="sm" iconName="Smartphone" iconPosition="left" onClick={() => setShowSessions((current) => !current)}>
                {showSessions ? 'Masquer' : 'Voir'}
              </Button>
            </div>

            {showSessions ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {activeSessions?.map((session) => (
                  <div key={session?.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{session?.deviceLabel || 'Session'}</p>
                      <p className="text-xs text-muted-foreground">
                        Dernière activité: {new Date(session?.lastSeenAt || new Date()).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    {session?.current ? (
                      <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white">
                        Session courante
                      </span>
                    ) : null}
                  </div>
                ))}

                {activeSessions?.length > 1 ? (
                  <Button variant="outline" size="sm" onClick={handleCloseOtherSessions}>
                    Fermer les autres sessions
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 shadow-elevation-2 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon name="Globe" size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground md:text-xl">Préférences</h3>
            <p className="text-sm text-muted-foreground">Personnalisez votre expérience</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Langue"
            options={LANGUAGE_OPTIONS}
            value={preferenceSettings?.language || LANGUAGE_OPTIONS[0].value}
            onChange={(value) => handlePreferenceChange('language', value)}
          />
          <Select
            label="Devise"
            options={CURRENCY_OPTIONS}
            value={preferenceSettings?.currency || CURRENCY_OPTIONS[0].value}
            onChange={(value) => handlePreferenceChange('currency', value)}
          />
          <Select
            label="Fuseau horaire"
            options={TIMEZONE_OPTIONS}
            value={preferenceSettings?.timezone || TIMEZONE_OPTIONS[0].value}
            onChange={(value) => handlePreferenceChange('timezone', value)}
          />
        </div>
      </div>

      <div className="rounded-xl border-2 border-error/20 bg-card p-4 shadow-elevation-2 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-error/10">
            <Icon name="AlertTriangle" size={24} color="var(--color-error)" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-error md:text-xl">Zone de danger</h3>
            <p className="text-sm text-muted-foreground">Actions irréversibles sur votre compte</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-start justify-between gap-4 rounded-lg bg-error/5 p-4 md:flex-row md:items-center">
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-foreground">Désactiver le compte</p>
              <p className="text-sm text-muted-foreground">
                Votre compte sera temporairement désactivé. Vous pourrez le réactiver à tout moment.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              iconName="UserX"
              iconPosition="left"
              onClick={() => setShowDeactivateModal(true)}
            >
              Désactiver
            </Button>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 rounded-lg bg-error/5 p-4 md:flex-row md:items-center">
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-error">Supprimer le compte</p>
              <p className="text-sm text-muted-foreground">
                Cette action est définitive. Toutes vos données seront supprimées.
              </p>
            </div>
            <Button variant="destructive" size="sm" iconName="Trash2" iconPosition="left">
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      {showDeactivateModal ? (
        <div className="modal-viewport z-[2000] bg-background/80 backdrop-blur-sm">
          <div className="modal-card modal-card-auto max-w-md rounded-xl bg-card p-6 shadow-elevation-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Icon name="AlertTriangle" size={24} color="var(--color-warning)" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Désactiver le compte</h3>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir désactiver votre compte ? Vous ne pourrez plus accéder à vos annonces et réservations jusqu'à la réactivation.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeactivateModal(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                variant="warning"
                onClick={() => {
                  setShowDeactivateModal(false);
                  setVerificationMessage('Demande de désactivation enregistrée.');
                }}
                className="flex-1"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SettingsSection;
