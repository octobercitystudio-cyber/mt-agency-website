const INVALID_RESET_CODE = 'invalid_reset_link';
const CORRECTABLE_RESET_CODES = new Set([
  'weak_password',
  'password_confirmation_mismatch',
  'password_reuse',
  'password_history_reuse',
]);

let capturedToken = '';
let pendingRelease = null;

const cancelPendingRelease = () => {
  if (pendingRelease === null) return;
  globalThis.clearTimeout(pendingRelease);
  pendingRelease = null;
};

const decodeFragment = hash => {
  try { return decodeURIComponent(String(hash || '').replace(/^#/, '').trim()); }
  catch { return ''; }
};

export const acquireResetFragment = (locationLike, historyLike) => {
  cancelPendingRelease();
  const fragment = decodeFragment(locationLike?.hash);
  if (fragment) {
    capturedToken = fragment;
    historyLike?.replaceState?.(null, '', `${locationLike?.pathname || '/reset-password'}${locationLike?.search || ''}`);
  }
  return capturedToken;
};

// React StrictMode probes an effect with setup → cleanup → setup. Delaying the
// release one task lets the second setup reclaim the in-memory fragment while
// still clearing it after a genuine unmount.
export const scheduleResetFragmentRelease = token => {
  cancelPendingRelease();
  if (!token) return;
  pendingRelease = globalThis.setTimeout(() => {
    if (capturedToken === token) capturedToken = '';
    pendingRelease = null;
  }, 0);
};

export const clearResetFragment = token => {
  cancelPendingRelease();
  if (!token || capturedToken === token) capturedToken = '';
};

export const resetCompletionKind = error => {
  if (!error) return 'success';
  if (error.code === INVALID_RESET_CODE) return 'invalid';
  if (CORRECTABLE_RESET_CODES.has(error.code)) return 'correctable';
  return 'retryable';
};

export const completeResetAttempt = async (client, token, credentials) => {
  const { error } = await client.request('/auth/password-reset/complete', {
    method: 'POST',
    body: JSON.stringify({ token, ...credentials }),
  });
  return { kind: resetCompletionKind(error), error };
};

export const resetResetPasswordFlowForTests = () => {
  cancelPendingRelease();
  capturedToken = '';
};
