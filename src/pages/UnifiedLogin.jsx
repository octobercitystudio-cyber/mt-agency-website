import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowDownLeft, Eye, EyeOff, LoaderCircle, X } from 'lucide-react';
import { useData } from '../store/DataContext';
import { normalizeLoginPhone } from '../lib/phoneLogin';
import { companyPhoneTel, companyPhoneWhatsApp } from '../lib/companyContact';
import GoogleSignIn from '../components/GoogleSignIn';
import './UnifiedLogin.css';

const STAFF_ROLES = ['owner', 'admin', 'operations', 'finance', 'staff'];
const CLIENT_TABS = ['home', 'schedule', 'packages', 'finance', 'offers', 'videos', 'security', 'requests', 'projects', 'history', 'book-studio'];
const SUPPORT_PHONE = '01114466646';
const safeClientDestination = search => {
  const requested = new URLSearchParams(search).get('returnTo');
  if (!requested) return '/dashboard';
  try {
    const url = new URL(requested, window.location.origin);
    const rawTab = url.searchParams.get('tab') || 'home';
    const tab = rawTab === 'montage' ? 'videos' : rawTab;
    if (url.origin !== window.location.origin || url.pathname !== '/dashboard' || !CLIENT_TABS.includes(tab)) return '/dashboard';
    if (rawTab === 'montage') url.searchParams.set('tab', 'videos');
    return `${url.pathname}${url.search}`;
  } catch { return '/dashboard'; }
};

const loginErrorMessage = loginError => {
  if (loginError?.code === 'validation_error') return 'أدخل رقم الموبايل الأساسي المسجّل بالحساب وكلمة المرور.';
  if (loginError?.code === 'invalid_credentials') return 'رقم الموبايل أو كلمة المرور غير صحيحة.';
  if (loginError?.code === 'account_disabled') return 'دخول هذا الحساب موقوف. تواصل مع إدارة الشركة لإعادة تفعيله.';
  if (loginError?.code === 'login_temporarily_blocked' || loginError?.status === 429) return 'توقفت محاولات الدخول مؤقتًا للحماية. انتظر قليلًا ثم حاول مرة أخرى.';
  if (loginError?.code === 'password_change_required') return 'سجّل الدخول برقم الموبايل وغيّر كلمة المرور أولًا، ثم اربط حساب Google.';
  if (loginError?.status >= 500 || !loginError?.code || loginError?.code === 'api_error') return 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت ثم حاول مرة أخرى.';
  return loginError?.message || 'تعذر تسجيل الدخول الآن. حاول مرة أخرى.';
};

export default function UnifiedLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [linkRequest, setLinkRequest] = useState(null);
  const { loginErp, linkGoogle, isAuthReady, currentUser } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const clientDestination = safeClientDestination(location.search);
  const phoneInput = useRef(null);
  const passwordInput = useRef(null);
  const supportDialog = useRef(null);
  const busy = loading || googleBusy;

  useEffect(() => {
    if (!isAuthReady || !currentUser?.role) return;
    if (['client', 'applicant'].includes(currentUser.role)) {
      navigate(currentUser.must_change_password ? '/change-password' : clientDestination, { replace: true });
    } else if (STAFF_ROLES.includes(currentUser.role)) {
      navigate('/erp', { replace: true });
    }
  }, [clientDestination, currentUser, isAuthReady, navigate]);

  useEffect(() => {
    if (!linkRequest) return;
    phoneInput.current?.focus();
    const timer = setTimeout(() => {
      setLinkRequest(null);
      setPassword('');
      setError('انتهت مهلة ربط Google. ابدأ المحاولة من جديد.');
    }, Math.max(0, linkRequest.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [linkRequest]);

  const routeUser = user => {
    if (['client', 'applicant'].includes(user?.role)) navigate(user.must_change_password ? '/change-password' : clientDestination, { replace: true });
    else if (user && STAFF_ROLES.includes(user.role)) navigate('/erp', { replace: true });
    else setError('هذا الحساب لا يملك صلاحية دخول لوحة النظام.');
  };

  const cancelLink = () => { setGoogleBusy(false); setLinkRequest(null); setPassword(''); setError(''); setFieldError(''); phoneInput.current?.focus(); };
  const handleGoogleResult = result => {
    setGoogleBusy(false);
    if (result?.link_required) {
      setLinkRequest({ token: result.link_token, expiresAt: Date.now() + result.expires_in * 1000 });
      setIdentifier(''); setPassword(''); setShowPassword(false); setError(''); setFieldError('');
    } else { setLinkRequest(null); routeUser(result); }
  };

  const handleLogin = async event => {
    event.preventDefault();
    if (!isAuthReady || busy) return;
    const phone = normalizeLoginPhone(identifier);
    if (!phone) {
      setFieldError('phone');
      setError('أدخل رقم الموبايل الأساسي المسجّل بالحساب. لا يمكن الدخول بالبريد الإلكتروني.');
      phoneInput.current?.focus();
      return;
    }
    if (!password) {
      setFieldError('password'); setError('أدخل كلمة المرور.'); passwordInput.current?.focus(); return;
    }
    setLoading(true); setError(''); setFieldError('');
    try {
      if (linkRequest && linkRequest.expiresAt <= Date.now()) { cancelLink(); setError('انتهت مهلة ربط Google. ابدأ المحاولة من جديد.'); return; }
      const user = linkRequest
        ? await linkGoogle({ link_token: linkRequest.token, phone, password })
        : await loginErp(phone, password);
      setLinkRequest(null); setPassword(''); routeUser(user);
    } catch (loginError) {
      if (linkRequest && ['google_challenge_expired', 'credentials_changed', 'google_link_expired', 'google_link_invalid', 'password_change_required'].includes(loginError.code)) { setLinkRequest(null); setPassword(''); }
      setError(loginErrorMessage(loginError));
    } finally { setLoading(false); }
  };

  const handleLocalPreview = async role => {
    if (busy) return;
    setLoading(true); setError('');
    try { routeUser(await loginErp(role === 'owner' ? 'local-owner' : 'local-client', 'local-preview')); }
    catch { setError('تعذر فتح المعاينة المحلية.'); }
    finally { setLoading(false); }
  };

  return <main className="unified-login-container" dir="rtl">
    <section className="unified-login-box" aria-labelledby="unified-login-title">
      <div className="unified-login-brand"><img src="/logo.webp" width="82" height="78" alt="Multi Task Agency" /><p dir="ltr">Multi Task Agency</p></div>
      <header className="unified-login-heading">
        <span className="unified-quiet-rule" aria-hidden="true" />
        <h1 id="unified-login-title">{linkRequest ? 'اربط حسابك، مرة واحدة.' : 'مساحتك، بخطوة واحدة.'}</h1>
        <p>{linkRequest ? 'أكّد حسابك الحالي برقم الموبايل وكلمة المرور' : 'سجّل الدخول لمتابعة باقاتك ومواعيدك'}</p>
      </header>
      {linkRequest && <div className="unified-link-note" role="status">بعد الربط، يمكنك الدخول مباشرة عبر Google. ليس لديك حساب؟ <Link to="/register">أنشئ حسابًا أولًا</Link>.</div>}
      <form className="unified-login-form" onSubmit={handleLogin} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className="unified-login-fields">
          <div className="unified-field">
            <label htmlFor="login-identifier">رقم الموبايل</label>
            <input ref={phoneInput} id="login-identifier" name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="01xxxxxxxxx" value={identifier} maxLength={32} onChange={event => { setIdentifier(event.target.value); setError(''); setFieldError(''); }} aria-invalid={fieldError === 'phone'} aria-describedby={error ? 'login-error' : undefined} dir="ltr" required />
          </div>
          <div className="unified-field unified-password-group">
            <div className="unified-label-row"><label htmlFor="login-password">كلمة المرور</label><button type="button" className="unified-text-button unified-forgot" onClick={() => supportDialog.current?.showModal()}>نسيت كلمة المرور؟</button></div>
            <div className="unified-password-wrap">
              <input ref={passwordInput} id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="أدخل كلمة المرور" value={password} onChange={event => { setPassword(event.target.value); setError(''); setFieldError(''); }} aria-invalid={fieldError === 'password'} aria-describedby={error ? 'login-error' : undefined} dir="ltr" required />
              <button className="unified-password-toggle" type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
            </div>
          </div>
        </fieldset>
        <button type="submit" className="unified-login-submit" disabled={loading || !isAuthReady || googleBusy} aria-busy={loading}>
          <span>{loading ? 'جارٍ تسجيل الدخول…' : !isAuthReady ? 'جارٍ تجهيز الدخول…' : linkRequest ? 'ربط Google وتسجيل الدخول' : 'تسجيل الدخول'}</span>
          {loading || !isAuthReady ? <LoaderCircle className="unified-login-spinner" aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
        </button>
        <div className="unified-login-feedback" aria-live="polite">{error && <p id="login-error" role="alert">{error}</p>}</div>
        {linkRequest && <button className="unified-text-button unified-cancel-link" type="button" disabled={busy} onClick={cancelLink}>إلغاء الربط والعودة للدخول</button>}
      </form>
      {!linkRequest && <GoogleSignIn disabled={busy || !isAuthReady} onResult={handleGoogleResult} onBusy={setGoogleBusy} onError={setError} />}
      <div className="unified-registration"><span>عميل جديد؟</span><Link className="unified-text-button" to="/register">إنشاء حساب <ArrowDownLeft aria-hidden="true" /></Link></div>
    </section>
    <footer className="unified-login-footer"><Link to="/">العودة للموقع الرئيسي <ArrowRight aria-hidden="true" /></Link></footer>
    {import.meta.env.DEV && <details className="unified-login-preview"><summary>خيارات المعاينة المحلية</summary><div><button type="button" disabled={busy} onClick={() => handleLocalPreview('owner')}>دخول تجريبي كمالك</button><button type="button" disabled={busy} onClick={() => handleLocalPreview('client')}>دخول تجريبي كعميل</button></div></details>}
    <dialog ref={supportDialog} className="unified-support-dialog" aria-labelledby="login-support-title" aria-describedby="login-support-description">
      <button type="button" className="unified-dialog-close" aria-label="إغلاق النافذة" onClick={() => supportDialog.current.close()}><X aria-hidden="true" /></button>
      <p className="unified-dialog-eyebrow">نساعدك ترجع لحسابك</p><h2 id="login-support-title">استعادة كلمة المرور</h2>
      <p id="login-support-description">تواصل مع الإدارة لطلب رابط استعادة كلمة المرور بعد التحقق من حسابك. إذا وصلك رابط بالفعل، افتحه لإكمال الاستعادة.</p>
      <a className="unified-support-primary" href={`https://wa.me/${companyPhoneWhatsApp(SUPPORT_PHONE)}`} target="_blank" rel="noopener noreferrer">تواصل مع الإدارة عبر واتساب</a>
      <a className="unified-support-phone" href={`tel:${companyPhoneTel(SUPPORT_PHONE)}`}>أو اتصل بنا: <bdi>{SUPPORT_PHONE}</bdi></a>
    </dialog>
  </main>;
}
