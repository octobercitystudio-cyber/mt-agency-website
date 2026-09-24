import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useData } from '../store/DataContext';
import { normalizeLoginPhone } from '../lib/phoneLogin';
import { isStaffAppEntry, STAFF_APP_SESSION_KEY } from '../lib/staffAppEntry';
import './AdminLogin.css';

const STAFF_ROLES = ['owner', 'admin', 'operations', 'finance', 'staff'];
const CLIENT_ROLES = ['client', 'applicant'];

const staffLoginError = error => {
  if (error?.code === 'validation_error') return 'أدخل البريد الإلكتروني أو رقم الموبايل المسجّل، وكلمة المرور.';
  if (error?.code === 'invalid_credentials') return 'بيانات الدخول غير صحيحة. راجع البيانات وحاول مرة أخرى.';
  if (error?.code === 'account_disabled') return 'دخول هذا الحساب موقوف. تواصل مع مسؤول النظام لإعادة تفعيله.';
  if (error?.code === 'login_temporarily_blocked' || error?.status === 429) return 'توقفت محاولات الدخول مؤقتًا للحماية. انتظر قليلًا ثم حاول مرة أخرى.';
  return 'تعذر تسجيل الدخول الآن. تحقق من الاتصال وحاول مرة أخرى.';
};

export default function AdminLogin() {
  const { loginStaff, logoutErp, isAuthReady, currentUser } = useData();
  const [staffApp] = useState(() => {
    try { return isStaffAppEntry(window.location.search, sessionStorage.getItem(STAFF_APP_SESSION_KEY) === '1'); }
    catch { return isStaffAppEntry(window.location.search); }
  });
  const otherAccountOpen = staffApp && CLIENT_ROLES.includes(currentUser?.role);
  useEffect(() => { if (staffApp) { try { sessionStorage.setItem(STAFF_APP_SESSION_KEY, '1'); } catch { /* Storage is optional. */ } } }, [staffApp]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const identifierInput = useRef(null);
  const passwordInput = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthReady) return;
    if (STAFF_ROLES.includes(currentUser?.role)) navigate('/erp', { replace: true });
    else if (!staffApp && CLIENT_ROLES.includes(currentUser?.role)) navigate(currentUser.must_change_password ? '/change-password' : '/dashboard', { replace: true });
  }, [currentUser, isAuthReady, navigate, staffApp]);

  const completeStaffLogin = user => {
    if (!STAFF_ROLES.includes(user?.role)) {
      setError('تعذر الدخول إلى مساحة فريق العمل بهذا الحساب.');
      return;
    }
    setPassword('');
    navigate('/erp', { replace: true });
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (loading || !isAuthReady) return;
    const value = identifier.trim();
    if (!normalizeLoginPhone(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError('identifier');
      setError('أدخل بريدًا إلكترونيًا أو رقم موبايل صحيحًا.');
      identifierInput.current?.focus();
      return;
    }
    if (!password) {
      setFieldError('password');
      setError('أدخل كلمة المرور.');
      passwordInput.current?.focus();
      return;
    }
    setLoading(true); setError(''); setFieldError('');
    try { completeStaffLogin(await loginStaff(value, password)); }
    catch (loginError) { setError(staffLoginError(loginError)); }
    finally { setLoading(false); }
  };

  const switchToStaffAccount = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try { const result = await logoutErp(); if (result?.error) throw result.error; }
    catch { setError('تعذر تبديل الحساب الآن. أعد المحاولة.'); }
    finally { setLoading(false); }
  };

  const handleLocalPreview = async () => {
    if (loading || !isAuthReady) return;
    setLoading(true); setError('');
    try { completeStaffLogin(await loginStaff('local-owner', 'local-preview')); }
    catch { setError('تعذر فتح المعاينة المحلية.'); }
    finally { setLoading(false); }
  };

  return <main className={`staff-login${staffApp ? ' staff-login--app' : ''}`} dir="rtl">
    <section className="staff-login-panel" aria-labelledby="staff-login-title">
      <header className="staff-login-brand">
        <img src="/logo.webp" width="64" height="61" alt="شعار Multi Task Agency" />
        <div><p dir="ltr">Multi Task Agency</p><span>{staffApp ? 'MTA Team · تطبيق الإدارة' : 'مساحة إدارة الشركة'}</span></div>
      </header>
      <div className="staff-login-intro">
        <span className="staff-login-eyebrow"><BriefcaseBusiness aria-hidden="true" /> بوابة الفريق</span>
        <h1 id="staff-login-title">{staffApp ? 'دخول المالك وفريق العمل' : 'دخول فريق العمل'}</h1>
        <p>مرحبًا بك. هذه المساحة مخصصة للمالك والعاملين في الشركة.</p>
      </div>
      {otherAccountOpen ? <section className="staff-account-switch" aria-label="تبديل الحساب">
        <p>يوجد حساب آخر مفتوح على هذا الجهاز. للدخول إلى إدارة الشركة، بدّل إلى حساب المالك أو أحد أفراد الفريق.</p>
        {error && <p role="alert">{error}</p>}
        <button type="button" className="staff-login-submit" disabled={loading} onClick={switchToStaffAccount}>{loading ? 'جارٍ تبديل الحساب…' : 'تبديل إلى حساب فريق العمل'}</button>
      </section> : <form className="staff-login-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
        <fieldset disabled={loading || !isAuthReady}>
          <div className="staff-login-field">
            <label htmlFor="staff-identifier">البريد الإلكتروني أو رقم الموبايل</label>
            <input ref={identifierInput} id="staff-identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck="false" dir="ltr" maxLength={254} value={identifier} onChange={event => { setIdentifier(event.target.value); setError(''); setFieldError(''); }} placeholder="name@company.com / 01xxxxxxxxx" aria-invalid={fieldError === 'identifier'} aria-describedby={`staff-identifier-hint${error ? ' staff-login-error' : ''}`} required />
            <p id="staff-identifier-hint">استخدم بيانات حسابك المسجّل لدى الإدارة.</p>
          </div>
          <div className="staff-login-field staff-login-password">
            <label htmlFor="staff-password">كلمة المرور</label>
            <div className="staff-login-password-wrap">
              <input ref={passwordInput} id="staff-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" dir="ltr" value={password} onChange={event => { setPassword(event.target.value); setError(''); setFieldError(''); }} placeholder="أدخل كلمة المرور" aria-invalid={fieldError === 'password'} aria-describedby={error ? 'staff-login-error' : undefined} required />
              <button type="button" className="staff-login-reveal" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword} aria-controls="staff-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
            </div>
          </div>
        </fieldset>
        <div className="staff-login-feedback" aria-live="polite">{error && <p id="staff-login-error" role="alert">{error}</p>}</div>
        <button type="submit" className="staff-login-submit" disabled={loading || !isAuthReady}>
          <span>{loading ? 'جارٍ تسجيل الدخول…' : !isAuthReady ? 'جارٍ تجهيز الدخول…' : 'الدخول إلى لوحة العمل'}</span>
          {loading || !isAuthReady ? <LoaderCircle className="staff-login-spinner" aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
        </button>
      </form>}
      <p className="staff-login-help">تحتاج مساعدة في الدخول؟ تواصل مع مسؤول النظام.</p>
      {!staffApp && <footer className="staff-login-client"><span>لديك حساب عميل؟</span><Link to="/login">دخول العملاء <ArrowLeft aria-hidden="true" /></Link></footer>}
    </section>
    {!staffApp && <Link className="staff-login-home" to="/">العودة للموقع الرئيسي <ArrowRight aria-hidden="true" /></Link>}
    {import.meta.env.DEV && <details className="staff-login-preview"><summary>المعاينة المحلية</summary><button type="button" disabled={loading || !isAuthReady} onClick={handleLocalPreview}>دخول تجريبي كمالك</button></details>}
  </main>;
}