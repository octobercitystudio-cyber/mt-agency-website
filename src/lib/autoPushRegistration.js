// Register on entry/resume; only the operating system decides whether permission is granted.
export function startAutomaticPushRegistration({ environment = window, loadConfiguration, register, onRegistered = () => {}, onPermissionNeeded = () => {}, onError = () => {} }) {
  let disposed = false, busy = false, registered = false, configuration;
  let permissionAttempted = false, gestureAttempted = false;
  const ensure = async (gesture = false) => {
    if (disposed || busy || registered) return;
    busy = true;
    try {
      if (!configuration) configuration = await loadConfiguration();
      if (disposed || !configuration?.enabled || !configuration?.schema_ready) return;
      const permission = environment.Notification.permission;
      if (permission === 'denied') { onPermissionNeeded(permission); return; }
      if (permission === 'default') {
        if (permissionAttempted && (!gesture || gestureAttempted)) return;
        permissionAttempted = true;
        if (gesture) gestureAttempted = true;
      }
      await register(configuration, permission === 'default', { isCurrent: () => !disposed });
      if (!disposed) { registered = true; onRegistered(); }
    } catch (error) {
      if (!disposed) {
        if (environment.Notification.permission !== 'granted') onPermissionNeeded(environment.Notification.permission);
        onError(error);
      }
    }
    finally { busy = false; }
  };
  const interact = event => { if (event.isTrusted) void ensure(true); };
  const resume = () => { if (environment.document.visibilityState === 'hidden') return; registered = false; void ensure(); };
  environment.addEventListener('click', interact);
  environment.addEventListener('keydown', interact);
  environment.addEventListener('online', resume);
  environment.addEventListener('focus', resume);
  environment.document.addEventListener('visibilitychange', resume);
  void ensure();
  return () => {
    disposed = true;
    environment.removeEventListener('click', interact);
    environment.removeEventListener('keydown', interact);
    environment.removeEventListener('online', resume);
    environment.removeEventListener('focus', resume);
    environment.document.removeEventListener('visibilitychange', resume);
  };
}
