export const TEST_MODE_SESSION_STORAGE_KEY = 'ldv-test-mode-active';
export const TEST_MODE_INSTRUCTIONS_STORAGE_KEY = 'ldv-test-mode-instructions-available';
export const TEST_MODE_OPEN_INSTRUCTIONS_EVENT = 'ldv:open-test-instructions';
export const TEST_MODE_INSTRUCTIONS_CHANGED_EVENT = 'ldv:test-instructions-availability-changed';

export const isTestModeSessionEnabled = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(TEST_MODE_SESSION_STORAGE_KEY) === '1';
};

export const enableTestModeSession = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TEST_MODE_SESSION_STORAGE_KEY, '1');
};

export const disableTestModeSession = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TEST_MODE_SESSION_STORAGE_KEY);
};

export const isTestModeInstructionsAvailable = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(TEST_MODE_INSTRUCTIONS_STORAGE_KEY) === '1';
};

export const setTestModeInstructionsAvailable = (isAvailable) => {
  if (typeof window === 'undefined') return;

  if (isAvailable) {
    window.sessionStorage.setItem(TEST_MODE_INSTRUCTIONS_STORAGE_KEY, '1');
  } else {
    window.sessionStorage.removeItem(TEST_MODE_INSTRUCTIONS_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(TEST_MODE_INSTRUCTIONS_CHANGED_EVENT, {
    detail: { isAvailable: Boolean(isAvailable) }
  }));
};

export const requestOpenTestModeInstructions = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TEST_MODE_OPEN_INSTRUCTIONS_EVENT));
};
