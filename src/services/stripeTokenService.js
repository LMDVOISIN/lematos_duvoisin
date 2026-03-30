function readPublishableKey() {
  return String(
    import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY
    || import.meta.env?.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    || ''
  ).trim();
}

function isTestPublishableKey(value = '') {
  return /^pk_test_/i.test(String(value || '').trim());
}

function normalizePhoneForStripe(value = '', { testMode = false } = {}) {
  if (testMode) {
    return '0000000000';
  }

  const raw = String(value || '').trim();
  const compact = raw.replace(/[^\d+]/g, '');
  const digitsOnly = compact.replace(/\D/g, '');

  if (!digitsOnly) return '';

  if (compact.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.startsWith('00') && digitsOnly.length > 4) {
    return `+${digitsOnly.slice(2)}`;
  }

  if (digitsOnly.startsWith('33') && digitsOnly.length === 11) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    return `+33${digitsOnly.slice(1)}`;
  }

  return digitsOnly;
}

let stripeLoaderPromise = null;

async function loadStripeConstructor() {
  if (typeof window === 'undefined') {
    throw new Error("Le service de tokenisation n'est disponible que dans le navigateur.");
  }

  if (typeof window.Stripe === 'function') {
    return window.Stripe;
  }

  if (!stripeLoaderPromise) {
    stripeLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-ldv-stripe-js="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.Stripe), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Impossible de charger le service de versement.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.defer = true;
      script.dataset.ldvStripeJs = 'true';
      script.onload = () => {
        if (typeof window.Stripe !== 'function') {
          reject(new Error('Le service de versement est indisponible.'));
          return;
        }
        resolve(window.Stripe);
      };
      script.onerror = () => reject(new Error('Impossible de charger le service de versement.'));
      document.head.appendChild(script);
    });
  }

  return stripeLoaderPromise;
}

async function getStripeClient() {
  const publishableKey = readPublishableKey();
  if (!publishableKey) {
    throw new Error('Configuration publique du service de versement manquante.');
  }

  const StripeCtor = await loadStripeConstructor();
  const stripe = StripeCtor(publishableKey);
  if (!stripe) {
    throw new Error("Impossible d'initialiser le service de versement.");
  }

  return stripe;
}

function parseBirthDateParts(birthDate) {
  const value = String(birthDate || '').trim();
  const [year, month, day] = value.split('-');
  const yearValue = Number.parseInt(year, 10);
  const monthValue = Number.parseInt(month, 10);
  const dayValue = Number.parseInt(day, 10);

  if (!yearValue || !monthValue || !dayValue) {
    throw new Error('Date de naissance invalide.');
  }

  return {
    year: yearValue,
    month: monthValue,
    day: dayValue
  };
}

function normalizeIban(iban) {
  return String(iban || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

async function createAccountToken({
  firstName,
  lastName,
  email,
  phone,
  birthDate,
  addressLine1,
  city,
  postalCode,
  country = 'FR'
} = {}) {
  const stripe = await getStripeClient();
  const testMode = isTestPublishableKey(readPublishableKey());
  const dob = parseBirthDateParts(birthDate);

  const { token, error } = await stripe.createToken('account', {
    business_type: 'individual',
    tos_shown_and_accepted: true,
    individual: {
      first_name: String(firstName || '').trim(),
      last_name: String(lastName || '').trim(),
      email: String(email || '').trim(),
      phone: normalizePhoneForStripe(phone, { testMode }),
      dob,
      address: {
        line1: String(addressLine1 || '').trim(),
        city: String(city || '').trim(),
        postal_code: String(postalCode || '').trim(),
        country
      }
    }
  });

  if (error) {
    if (/valid phone number/i.test(String(error?.message || ''))) {
      throw new Error(
        testMode
          ? "Le numéro de téléphone doit être remplacé automatiquement en mode test. Rechargez la page et réessayez."
          : "Le numéro de téléphone doit être saisi dans un format valide, par exemple +33612345678."
      );
    }
    if (/account tokens?/i.test(String(error?.message || ''))) {
      throw new Error(
        "Le mode de versement natif n'est pas encore complètement actif sur cette configuration."
      );
    }
    throw new Error(error?.message || "Impossible de préparer vos informations d'identité.");
  }

  return token?.id || null;
}

async function createBankAccountToken({
  iban,
  accountHolderName,
  country = 'FR',
  currency = 'eur'
} = {}) {
  const stripe = await getStripeClient();

  const { token, error } = await stripe.createToken('bank_account', {
    country,
    currency,
    account_holder_name: String(accountHolderName || '').trim(),
    account_holder_type: 'individual',
    account_number: normalizeIban(iban)
  });

  if (error) {
    if (/test bank account number/i.test(String(error?.message || ''))) {
      throw new Error(
        "Le site est encore en mode test. Pour essayer ce formulaire, utilisez un IBAN de test, par exemple FR14 2004 1010 0505 0001 3M02 606."
      );
    }
    throw new Error(error?.message || "Impossible de sécuriser votre compte bancaire.");
  }

  return token?.id || null;
}

const stripeTokenService = {
  isTestMode() {
    return isTestPublishableKey(readPublishableKey());
  },

  getSuggestedTestIban() {
    return 'FR1420041010050500013M02606';
  },

  async createPayoutTokens({
    needsIdentity = true,
    profile = {},
    iban
  } = {}) {
    const accountHolderName = [profile?.firstName, profile?.lastName]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!accountHolderName) {
      throw new Error('Le nom du titulaire du compte bancaire est requis.');
    }

    const bankAccountTokenId = await createBankAccountToken({
      iban,
      accountHolderName
    });

    let accountTokenId = null;
    if (needsIdentity) {
      accountTokenId = await createAccountToken({
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        email: profile?.email,
        phone: profile?.phone,
        birthDate: profile?.birthDate,
        addressLine1: profile?.addressLine1,
        city: profile?.city,
        postalCode: profile?.postalCode
      });
    }

    return {
      accountTokenId,
      bankAccountTokenId
    };
  }
};

export default stripeTokenService;
