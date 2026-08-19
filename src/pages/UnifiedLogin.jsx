import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import { useData } from '../store/DataContext';
import './UnifiedLogin.css';

const STAFF_ROLES = ['owner', 'admin', 'operations', 'finance', 'staff'];
const CLIENT_TABS = ['home', 'schedule', 'finance', 'offers', 'videos'];
const safeClientDestination = search => {
  const requested = new URLSearchParams(search).get('returnTo');
  if (!requested) return '/dashboard';
  try {
    const url = new URL(requested, window.location.origin); const rawTab = url.searchParams.get('tab') || 'home'; const tab = rawTab === 'montage' ? 'videos' : rawTab;
    if (url.origin !== window.location.origin || url.pathname !== '/dashboard' || !CLIENT_TABS.includes(tab)) return '/dashboard';
    if (rawTab === 'montage') url.searchParams.set('tab', 'videos');
    return `${url.pathname}${url.search}`;
  } catch { return '/dashboard'; }
};

const loginErrorMessage = loginError => {
  if (loginError?.code === 'validation_error') return 'أدخل رقم الهاتف أو البريد الإلكتروني وكلمة المرور.';
  if (loginError?.code === 'invalid_credentials') return 'رقم الهاتف أو البريد أو كلمة المرور غير صحيحة.';
  if (loginError?.code === 'account_disabled') return 'دخول هذا الحساب موقوف. تواصل مع إدارة الشركة لإعادة تفعيله.';
  if (loginError?.code === 'login_temporarily_blocked') return 'توقفت محاولات الدخول مؤقتًا للحماية. انتظر قليلًا ثم حاول مرة أخرى.';
  if (loginError?.status >= 500 || !loginError?.code || loginError?.code === 'api_error') return 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت ثم حاول مرة أخرى.';
  return loginError?.message || 'تعذر تسجيل الدخول الآن. حاول مرة أخرى.';
};

const UnifiedLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginErp, isAuthReady, currentUser } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const clientDestination = safeClientDestination(location.search);

  useEffect(() => {
    if (!isAuthReady || !currentUser?.role) return;
    if (currentUser.role === 'client') {
      const defaultClientDestination = currentUser.must_change_password ? '/change-password' : '/dashboard';
      navigate(currentUser.must_change_password ? defaultClientDestination : clientDestination, { replace: true });
    } else if (STAFF_ROLES.includes(currentUser.role)) {
      navigate('/erp', { replace: true });
    }
  }, [clientDestination, currentUser, isAuthReady, navigate]);

  const handleLogin = async event => {
    event.preventDefault();
    if (!isAuthReady || loading) return;
    if (!identifier.trim() || !password) {
      setError('أدخل رقم الهاتف أو البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const user = await loginErp(identifier.trim(), password);
      if (user?.role === 'client') {
        navigate(user.must_change_password ? '/change-password' : clientDestination, { replace: true });
        return;
      }
      if (user && STAFF_ROLES.includes(user.role)) {
        navigate('/erp', { replace: true });
        return;
      }
      setError(user ? 'هذا الحساب لا يملك صلاحية دخول لوحة النظام.' : 'رقم الهاتف أو البريد أو كلمة المرور غير صحيحة.');
    } catch (loginError) {
      setError(loginErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  const handleLocalPreview = async () => {
    setLoading(true);
    setError('');
    const user = await loginErp('local-owner', 'local-preview');
    if (user) {
      navigate('/erp');
      return;
    }
    setError('تعذر فتح المعاينة المحلية.');
    setLoading(false);
  };

  const handleLocalClientPreview = async () => {
    setLoading(true);
    setError('');
    const user = await loginErp('local-client', 'local-preview');
    if (user) {
      navigate(clientDestination);
      return;
    }
    setError('تعذر فتح معاينة العميل المحلية.');
    setLoading(false);
  };

  return <main className="unified-login-container" dir="rtl">
    <section className="unified-login-box premium-glass" aria-labelledby="unified-login-title">
      <div className="brand-logo" aria-label="MT Agency">MT <span>Agency</span></div>
      <header className="unified-login-heading">
        <p>بوابة العملاء والفريق</p>
        <h1 id="unified-login-title">تسجيل الدخول</h1>
        <span>أدخل بياناتك للوصول إلى لوحة التحكم الخاصة بك.</span>
      </header>

      <form className="login-form" onSubmit={handleLogin} noValidate>
        <label className="unified-field" htmlFor="login-identifier">
          <span>رقم الهاتف أو البريد الإلكتروني</span>
          <span className="unified-input-shell">
            <UserRound aria-hidden="true" />
            <input id="login-identifier" type="text" inputMode="email" autoComplete="username" placeholder="مثال: 01012345678" value={identifier} onChange={event => { setIdentifier(event.target.value); if (error) setError(''); }} aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} dir="ltr" required />
          </span>
        </label>

        <label className="unified-field" htmlFor="login-password">
          <span>كلمة المرور</span>
          <span className="unified-input-shell">
            <LockKeyhole aria-hidden="true" />
            <input id="login-password" type="password" autoComplete="current-password" placeholder="أدخل كلمة المرور" value={password} onChange={event => { setPassword(event.target.value); if (error) setError(''); }} aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} dir="ltr" required />
          </span>
        </label>

        <div className="unified-login-feedback" aria-live="polite">
          {error && <p id="login-error" className="error-msg" role="alert">{error}</p>}
        </div>

        <button type="submit" className="unified-login-submit" disabled={loading || !isAuthReady} aria-busy={loading}>
          <span className="unified-login-submit__icon">{loading || !isAuthReady ? <LoaderCircle className="unified-login-spinner" aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}</span>
          <span>{loading ? 'جارٍ تسجيل الدخول…' : !isAuthReady ? 'جارٍ تجهيز الدخول…' : 'تسجيل الدخول'}</span>
        </button>

        {import.meta.env.DEV && <div className="unified-login-preview" aria-label="خيارات المعاينة المحلية">
          <button type="button" disabled={loading} onClick={handleLocalPreview}>دخول تجريبي كمالك</button>
          <button type="button" disabled={loading} onClick={handleLocalClientPreview}>دخول تجريبي كعميل</button>
        </div>}
      </form>

      <a href="/" className="back-link">العودة للموقع الرئيسي</a>
    </section>
  </main>;
};

export default UnifiedLogin;
