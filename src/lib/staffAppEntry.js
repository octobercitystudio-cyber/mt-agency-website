export const STAFF_APP_SESSION_KEY = 'mta_staff_android_entry';
// Presentation only. The staff API and role guards remain the access boundary.
export function isStaffAppEntry(search = '', remembered = false, referrer = '') {
  const source = new URLSearchParams(search).get('source');
  let teamReferrer = false;
  try { const app = new URL(referrer); teamReferrer = app.protocol === 'android-app:' && app.hostname === 'com.multitaskagency.staff'; } catch { /* Referrer is optional. */ }
  return remembered || teamReferrer || source === 'android-staff-app' || source === 'android-staff-shortcut';
}
