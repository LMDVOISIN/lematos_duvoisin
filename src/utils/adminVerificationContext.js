const VERIFY_FLAG_PARAM = 'ldv_verify';
const VERIFY_ID_PARAM = 'ldv_verification_id';
const VERIFY_TARGET_PARAM = 'ldv_verification_target';

const safeWindow = () => (typeof window === 'undefined' ? null : window);

const readSearchParams = () => {
  const currentWindow = safeWindow();
  if (!currentWindow?.location?.search) {
    return new URLSearchParams();
  }

  return new URLSearchParams(currentWindow.location.search);
};

export const readAdminVerificationContext = () => {
  const params = readSearchParams();
  const enabled = params.get(VERIFY_FLAG_PARAM) === '1';

  return {
    enabled,
    verificationId: String(params.get(VERIFY_ID_PARAM) || '').trim(),
    target: String(params.get(VERIFY_TARGET_PARAM) || '').trim()
  };
};

export const isAdminVerificationEnabled = () => readAdminVerificationContext().enabled;

export const getAdminVerificationId = () => readAdminVerificationContext().verificationId;

export const isAdminVerificationScenario = (...candidateIds) => {
  const context = readAdminVerificationContext();
  if (!context.enabled || !context.verificationId) return false;

  return candidateIds
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .includes(context.verificationId);
};

export const buildAdminVerificationSearchParams = ({
  verificationId,
  target = ''
} = {}) => {
  const params = new URLSearchParams();
  params.set(VERIFY_FLAG_PARAM, '1');

  if (verificationId) {
    params.set(VERIFY_ID_PARAM, String(verificationId));
  }

  if (target !== '') {
    params.set(VERIFY_TARGET_PARAM, String(target));
  }

  return params;
};

export const appendAdminVerificationParamsToPath = (
  path,
  overrides = {}
) => {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return normalizedPath;

  const context = readAdminVerificationContext();
  if (!context?.enabled) return normalizedPath;

  const [pathWithoutHash, hashFragment = ''] = normalizedPath.split('#');
  const [pathname, searchString = ''] = pathWithoutHash.split('?');
  const params = new URLSearchParams(searchString);
  const verificationParams = buildAdminVerificationSearchParams({
    verificationId: overrides?.verificationId || context?.verificationId,
    target: overrides?.target ?? context?.target ?? ''
  });

  verificationParams.forEach((value, key) => {
    params.set(key, value);
  });

  const nextSearch = params.toString();
  const nextPath = `${pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  return hashFragment ? `${nextPath}#${hashFragment}` : nextPath;
};
