import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const SettingsSection = ({ settings, onUpdateSettings }) => {
  const [notificationSettings, setNotificationSettings] = useState(settings?.notifications);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const handleNotificationChange = (key, value) => {
    const updated = {
      ...notificationSettings,
      [key]: value
    };
    setNotificationSettings(updated);
    onUpdateSettings({ notifications: updated });
  };

  const notificationOptions = [
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
      description: 'Notification lors de la validation d\'un paiement'
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
      description: 'Recevoir un e-mail quotidien avec l\'activité de votre compte'
    },
    {
      id: 'promotions',
      label: 'Promotions et actualités',
      description: 'Recevoir les offres spéciales et les nouveautés de la plateforme'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="Bell" size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-foreground">Préférences de notification</h3>
            <p className="text-sm text-muted-foreground">Gérez comment vous souhaitez être notifié</p>
          </div>
        </div>

        <div className="space-y-4">
          {notificationOptions?.map((option) => (
            <div key={option?.id} className="flex items-start gap-4 p-4 bg-surface rounded-lg">
              <Checkbox
                checked={notificationSettings?.[option?.id]}
                onChange={(e) => handleNotificationChange(option?.id, e?.target?.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground cursor-pointer">
                  {option?.label}
                </label>
                <p className="text-sm text-muted-foreground mt-1">{option?.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="Lock" size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-foreground">Sécurité</h3>
            <p className="text-sm text-muted-foreground">Gérez la sécurité de votre compte</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Mot de passe</p>
              <p className="text-sm text-muted-foreground">Dernière modification il y a 45 jours</p>
            </div>
            <Button variant="outline" size="sm" iconName="Key" iconPosition="left">
              Modifier
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Authentification à deux facteurs</p>
              <p className="text-sm text-muted-foreground">Ajoutez une couche de sécurité supplémentaire</p>
            </div>
            <Button variant="outline" size="sm" iconName="Shield" iconPosition="left">
              Activer
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Sessions actives</p>
              <p className="text-sm text-muted-foreground">Gérez vos appareils connectés</p>
            </div>
            <Button variant="outline" size="sm" iconName="Smartphone" iconPosition="left">
              Voir
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="Globe" size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-foreground">Préférences</h3>
            <p className="text-sm text-muted-foreground">Personnalisez votre expérience</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Langue</p>
              <p className="text-sm text-muted-foreground">Français</p>
            </div>
            <Button variant="outline" size="sm" iconName="Languages" iconPosition="left">
              Modifier
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Devise</p>
              <p className="text-sm text-muted-foreground">Euro (€)</p>
            </div>
            <Button variant="outline" size="sm" iconName="Euro" iconPosition="left">
              Modifier
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Fuseau horaire</p>
              <p className="text-sm text-muted-foreground">Europe/Paris (UTC+1)</p>
            </div>
            <Button variant="outline" size="sm" iconName="Clock" iconPosition="left">
              Modifier
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2 border-2 border-error/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-error/10 rounded-lg flex items-center justify-center">
            <Icon name="AlertTriangle" size={24} color="var(--color-error)" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-error">Zone de danger</h3>
            <p className="text-sm text-muted-foreground">Actions irréversibles sur votre compte</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-error/5 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Désactiver le compte</p>
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

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-error/5 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-error mb-1">Supprimer le compte</p>
              <p className="text-sm text-muted-foreground">
                Cette action est définitive. Toutes vos données seront supprimées.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              iconName="Trash2"
              iconPosition="left"
            >
              Supprimer
            </Button>
          </div>
        </div>
      </div>
      {showDeactivateModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card rounded-xl p-6 max-w-md w-full shadow-elevation-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                <Icon name="AlertTriangle" size={24} color="var(--color-warning)" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Désactiver le compte</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Êtes-vous sûr de vouloir désactiver votre compte ? Vous ne pourrez plus accéder à vos annonces et réservations jusqu'à la réactivation.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeactivateModal(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                variant="warning"
                onClick={() => {
                  setShowDeactivateModal(false);
                }}
                className="flex-1"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsSection;

