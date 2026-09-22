const SCRIPT_ID = 'mt-google-identity';
let scriptPromise;

export const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID);
    if (script) script.remove();
    script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client?hl=ar';
    script.async = true;
    script.defer = true;
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      scriptPromise = undefined;
      reject(new Error('تعذر تحميل تسجيل الدخول عبر Google.'));
    };
    const timeout = setTimeout(fail, 12000);
    script.onload = () => {
      clearTimeout(timeout);
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
};
