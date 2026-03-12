import React, { useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!email) {
      setError('L\'adresse e-mail est requise');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(email)) {
      setError('Adresse e-mail invalide');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) {
        setError(resetError?.message || 'Impossible d\'envoyer le courriel de reinitialisation');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('Erreur inattendue lors de l\'envoi du courriel');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-xl shadow-elevation-4 border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
          <h2 className="text-lg md:text-xl font-semibold text-foreground">
            Réinitialiser le mot de passe
          </h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-smooth"
            aria-label="Fermer"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              <p className="text-sm md:text-base text-muted-foreground">
                Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              <Input
                label="Adresse e-mail"
                type="email"
                placeholder="votre.courriel@exemple.fr"
                value={email}
                onChange={(e) => {
                  setEmail(e?.target?.value);
                  setError('');
                }}
                error={error}
                required
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="default"
                  loading={loading}
                  iconName="Send"
                  iconPosition="right"
                  className="flex-1"
                >
                  Envoyer
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/10">
                  <Icon name="CheckCircle" size={32} color="var(--color-success)" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Courriel envoyé !</h3>
                <p className="text-sm text-muted-foreground">
                  Vérifiez votre boîte de réception. Un courriel contenant les instructions pour réinitialiser votre mot de passe a été envoyé à <strong>{email}</strong>
                </p>
              </div>
              <Button
                variant="default"
                size="default"
                onClick={handleClose}
                fullWidth
              >
                Compris
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
