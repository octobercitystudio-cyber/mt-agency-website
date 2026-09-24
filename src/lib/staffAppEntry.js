export const STAFF_APP_SESSION_KEY = 'mta_staff_android_entry';
// Presentation only. The staff API and role guards remain the access boundary.
export function isStaffAppEntry(search = '', remembered = false) {
  const source = new URLSearchParams(search).get('source');
  return remembered || source === 'android-staff-app' || source === 'android-staff-shortcut';
}
