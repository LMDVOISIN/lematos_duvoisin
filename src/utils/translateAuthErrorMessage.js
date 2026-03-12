const AUTH_ERROR_TRANSLATIONS = [
  {
    pattern: /new password should be different from the old password/i,
    message: "Le nouveau mot de passe doit être différent de l'ancien."
  },
  {
    pattern: /password should be at least \d+ characters/i,
    message: 'Le mot de passe est trop court.'
  },
  {
    pattern: /invalid login credentials/i,
    message: 'Identifiants invalides.'
  },
  {
    pattern: /email not confirmed/i,
    message: "Votre adresse e-mail n'est pas encore confirmée."
  },
  {
    pattern: /user already registered/i,
    message: 'Un compte existe déjà avec cette adresse e-mail.'
  },
  {
    pattern: /signup is disabled/i,
    message: "La création de compte est temporairement indisponible."
  },
  {
    pattern: /unable to validate email address/i,
    message: "Adresse e-mail invalide."
  },
  {
    pattern: /password is too weak/i,
    message: 'Le mot de passe est trop faible.'
  },
  {
    pattern: /otp expired/i,
    message: 'Le lien a expiré. Merci de recommencer.'
  },
  {
    pattern: /token has expired/i,
    message: 'Le lien a expiré. Merci de recommencer.'
  },
  {
    pattern: /invalid token/i,
    message: 'Le lien est invalide.'
  },
  {
    pattern: /refresh token not found/i,
    message: 'Session expirée. Merci de vous reconnecter.'
  },
  {
    pattern: /for security purposes, you can only request this after/i,
    message: 'Veuillez patienter avant de refaire une demande.'
  },
  {
    pattern: /email rate limit exceeded/i,
    message: "Trop de demandes. Merci d'essayer plus tard."
  }
];

const ENGLISH_HINTS = [
  'password',
  'login',
  'sign',
  'email',
  'token',
  'session',
  'credentials',
  'invalid',
  'request',
  'user',
  'expired',
  'failed',
  'reset'
];

function normalizeMessage(message) {
  return String(message || '')
    .replace(/\+/g, ' ')
    .trim();
}

function containsLikelyEnglish(message) {
  const lower = message.toLowerCase();
  return ENGLISH_HINTS.some((hint) => lower.includes(hint));
}

export function translateAuthErrorMessage(rawMessage, fallbackMessage = "Une erreur est survenue. Merci de réessayer.") {
  const message = normalizeMessage(rawMessage);
  if (!message) return fallbackMessage;

  const translated = AUTH_ERROR_TRANSLATIONS.find(({ pattern }) => pattern.test(message));
  if (translated) return translated.message;

  if (containsLikelyEnglish(message)) {
    return fallbackMessage;
  }

  return message;
}

