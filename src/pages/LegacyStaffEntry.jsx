import { Navigate, useLocation } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { legacyStaffDestination } from '../lib/staffRoutes';

export default function LegacyStaffEntry() {
  const { currentUser, isAuthReady } = useData();
  const location = useLocation();
  if (!isAuthReady) return <p role="status">جارٍ مراجعة الدخول…</p>;
  if (['owner', 'admin', 'operations', 'finance', 'staff'].includes(currentUser?.role)) {
    return <Navigate replace to={`${legacyStaffDestination(location.pathname)}${location.search}${location.hash}`} />;
  }
  return <main dir="rtl" className="staff-login"><section className="staff-login-panel">
    <img src="/logo.webp" width="64" alt="Multi Task Agency" />
    <h1>تم تحديث بوابة فريق العمل</h1>
    <p>استخدم رابط الدخول الجديد الذي يوفّره المالك، أو حدّث تطبيق الإدارة للوصول إلى بوابة الدخول.</p>
    <a className="staff-login-submit" href="/downloads/MTA-Team-1.0.3.apk">تحميل تحديث تطبيق الإدارة</a>
  </section></main>;
}
