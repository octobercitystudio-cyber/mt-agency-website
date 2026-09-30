import { Link, Navigate, useLocation } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { legacyStaffDestination, STAFF_LOGIN_PATH } from '../lib/staffRoutes';
import { isStaffAppEntry, STAFF_APP_SESSION_KEY } from '../lib/staffAppEntry';

export default function LegacyStaffEntry() {
  const { currentUser, isAuthReady } = useData();
  const location = useLocation();
  let remembered = false;
  try { remembered = sessionStorage.getItem(STAFF_APP_SESSION_KEY) === '1'; } catch { /* Recovery also works without storage. */ }
  const staffApp = isStaffAppEntry(location.search, remembered, document.referrer);
  if (!isAuthReady) return <p role="status">جارٍ مراجعة الدخول…</p>;
  if (['owner', 'admin', 'operations', 'finance', 'staff'].includes(currentUser?.role)) {
    return <Navigate replace to={`${legacyStaffDestination(location.pathname)}${location.search}${location.hash}`} />;
  }
  if (staffApp) return <Navigate replace to={`${STAFF_LOGIN_PATH}?source=android-staff-app`} />;
  return <main dir="rtl" className="staff-login"><section className="staff-login-panel">
    <img src="/logo.webp" width="64" alt="Multi Task Agency" />
    <h1>تم تحديث بوابة فريق العمل</h1>
    <p>الرابط المحفوظ قديم. اضغط الزر التالي لفتح صفحة الدخول الحالية بنفس بيانات حسابك.</p>
    <Link className="staff-login-submit" to={`${STAFF_LOGIN_PATH}?source=android-staff-app`}>فتح تسجيل دخول فريق العمل</Link>
  </section></main>;
}
