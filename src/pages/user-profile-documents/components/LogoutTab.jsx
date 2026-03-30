import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';

const LogoutTab = () => {
  const { user, userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await signOut();

      if (error) {
        toast?.error(error?.message || 'Déconnexion impossible. Merci de réessayer.');
        return;
      }

      navigate('/authentification', { replace: true });
    } catch (error) {
      toast?.error(error?.message || 'Déconnexion impossible. Merci de réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-6 shadow-elevation-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-surface rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Compte</p>
            <p className="text-sm font-medium text-foreground">{userProfile?.pseudo || user?.user_metadata?.pseudo || 'Utilisateur'}</p>
          </div>
          <div className="bg-surface rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Email</p>
            <p className="text-sm font-medium text-foreground break-all">{user?.email || userProfile?.email || '-'}</p>
          </div>
        </div>

        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Icon name="ShieldAlert" size={20} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Avant de vous déconnecter</p>
              <p className="text-sm text-muted-foreground">
                Vérifiez que vos modifications de profil ou de versement ont bien été terminées avant de fermer votre session.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="destructive"
            size="lg"
            iconName="LogOut"
            onClick={handleLogout}
            loading={isSubmitting}
          >
            Me déconnecter
          </Button>
          <Button
            variant="outline"
            size="lg"
            iconName="User"
            onClick={() => navigate('/profil-documents-utilisateur')}
          >
            Retour au profil
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LogoutTab;
