import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import feedbackService from '../services/feedbackService';
import Icon from './AppIcon';
import Button from './ui/Button';
import Input from './ui/Input';

const INITIAL_FORM_STATE = {
  message: '',
  email: ''
};

const FEEDBACK_INTRO = "Un probl\u00e8me, une id\u00e9e ou un commentaire ? \u00c9cris-nous ici. Cela prend moins d\u2019une minute.";
const FEEDBACK_SUCCESS_TITLE = "Merci ! Ton message a bien \u00e9t\u00e9 envoy\u00e9.";
const FEEDBACK_SUCCESS_DESCRIPTION = "Nous le lirons d\u00e8s que possible.";
const FEEDBACK_PLACEHOLDER = "D\u00e9cris ce que tu as aim\u00e9, ce qui t\u2019a g\u00ean\u00e9, ou ce que tu aimerais am\u00e9liorer.";
const FEEDBACK_EMAIL_HELP = "Si tu veux qu\u2019on puisse te r\u00e9pondre.";

const FeedbackModal = ({ isOpen, onClose }) => {
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [originUrl, setOriginUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setOriginUrl(typeof window !== 'undefined' ? window?.location?.href || '' : '');
    setFormState(INITIAL_FORM_STATE);
    setIsSubmitted(false);
  }, [isOpen]);

  const safeOriginUrl = useMemo(() => {
    if (originUrl) return originUrl;
    if (typeof window !== 'undefined') return window?.location?.href || '';
    return '';
  }, [originUrl]);

  const closeModal = () => {
    if (isSubmitting) return;
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    const message = formState?.message?.trim();
    if (!message) {
      toast?.error('Ton message est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await feedbackService?.submitFeedback(message, {
        email: formState?.email?.trim(),
        pageUrl: safeOriginUrl,
        pagePath: typeof window !== 'undefined' ? window?.location?.pathname : '',
        pageTitle: typeof document !== 'undefined' ? document?.title : '',
        referrer: typeof document !== 'undefined' ? document?.referrer : '',
        userAgent: typeof navigator !== 'undefined' ? navigator?.userAgent : '',
        status: 'new'
      });

      if (error) throw error;
      setIsSubmitted(true);
    } catch (error) {
      console.error('Feedback submit error:', error);
      toast?.error(error?.message || 'Impossible d\'envoyer ton message pour le moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-lg w-full p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Envoyer un feedback</h2>
            <p className="text-sm text-muted-foreground mt-1">{FEEDBACK_INTRO}</p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={closeModal}
            disabled={isSubmitting}
            aria-label="Fermer"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="text-sm font-medium text-green-800">{FEEDBACK_SUCCESS_TITLE}</p>
              <p className="text-sm text-green-700 mt-1">{FEEDBACK_SUCCESS_DESCRIPTION}</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={closeModal}>
                Retour
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ton message
              </label>
              <textarea
                value={formState?.message}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    message: event?.target?.value || ''
                  }))
                }
                placeholder={FEEDBACK_PLACEHOLDER}
                className="w-full min-h-[140px] px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}
              />
            </div>

            <Input
              type="email"
              label="Ton email (facultatif)"
              description={FEEDBACK_EMAIL_HELP}
              placeholder="exemple@email.com"
              value={formState?.email}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  email: event?.target?.value || ''
                }))
              }
              disabled={isSubmitting}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                Envoyer
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
