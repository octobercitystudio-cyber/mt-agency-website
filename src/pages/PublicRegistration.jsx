import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import { normalizeRegistrationDigits, registrationFullName } from '../lib/registrationPolicy';
import { safeUiError } from '../lib/uiError';
import RegistrationBotCheck from '../components/RegistrationBotCheck';
import ClientSupport from '../components/ClientSupport';
import PromotionGiftLauncher from '../components/PromotionGiftLauncher';
import usePublicGiftPromotions from '../components/usePublicGiftPromotions';
import { safeClientDestination, clientAuthPath } from '../lib/clientAuthDestination';
import './PublicRegistration.css';
import './AuthGoldTheme.css';

const emptyForm = { first_name: '', second_name: '', last_name: '', phone: '', job: '', password: '', password_confirmation: '' };
const botErrors = ['bot_verification_required', 'bot_verification_failed', 'bot_verification_expired'];
const registrationError = error => {
  if (botErrors.includes(error?.code)) return 'أعد التحقق من أنك لست روبوتًا، ثم اضغط إنشاء حساب. بياناتك محفوظة في النموذج.';
  if (error?.code === 'registration_rate_limited' || error?.status === 429) return 'محاولات التسجيل كثيرة حاليًا. انتظر قليلًا ثم حاول مرة أخرى.';
  return safeUiError(error, 'تعذر إنشاء الحساب. تأكد من الاتصال وحاول مرة أخرى.');
};

export default function PublicRegistration() {
  const { loginErp, currentUser, authRetryNotice } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const clientDestination = safeClientDestination(location.search, window.location.origin);
  const [form, setForm] = useState(emptyForm);
  const [website, setWebsite] = useState('');
  const [botPayload, setBotPayload] = useState('');
  const [botRevision, setBotRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submissionRef = useRef(false);
  const confirmationRef = useRef(null);
  const registrationHeadingRef = useRef(null);
  const giftPromotions = usePublicGiftPromotions();
  const focusRegistration = () => {
    registrationHeadingRef.current?.focus({ preventScroll: true });
    registrationHeadingRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  };
  const patch = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (['client', 'applicant'].includes(currentUser?.role)) navigate(clientDestination, { replace: true });
  }, [clientDestination, currentUser, navigate]);
  const resetBot = () => { setBotPayload(''); setBotRevision(value => value + 1); };
  const submit = async event => {
    event.preventDefault();
    if (submissionRef.current || success) return;
    setError('');
    try { registrationFullName(form); } catch (failure) { setError(failure.message); return; }
    if (form.password !== form.password_confirmation) { setError('تأكيد كلمة المرور غير مطابق.'); confirmationRef.current?.focus(); return; }
    if (!botPayload) { setError('أكمل التحقق من أنك لست روبوتًا أولًا.'); return; }
    submissionRef.current = true; setBusy(true);
    let created = false;
    try {
      const response = await dataClient.request('/registration/complete', { method: 'POST', body: JSON.stringify({ ...form, phone: form.phone.trim(), job: form.job.trim(), altcha: botPayload, website }) });
      if (response.error) {
        if (response.error.code === 'registration_already_submitted') { setSuccess(true); setError('تم إرسال تسجيل هذا الحساب بالفعل. سجّل الدخول برقم الموبايل وكلمة المرور.'); return; }
        setError(registrationError(response.error)); resetBot(); return;
      }
      created = true;
      setSuccess(true);
      await loginErp(form.phone, form.password);
      navigate(clientDestination, { replace: true });
    } catch (failure) {
      if (created) setError('تم إنشاء حسابك بنجاح. سجّل الدخول برقم الموبايل وكلمة المرور.');
      else { setError(registrationError(failure)); resetBot(); }
    } finally {
      if (created) { setForm(previous => ({ ...previous, password: '', password_confirmation: '' })); setBotPayload(''); }
      submissionRef.current = false; setBusy(false);
    }
  };

  return <main className="registration-page auth-gold-page" dir="rtl">
    <div className="registration-shell">
      <header className="registration-topbar"><Link to="/" aria-label="الموقع الرئيسي"><img src="/brand/gold/mt-agency-logo.webp" width="90" height="73" alt="Multi Task Agency"/></Link><span>عندك حساب؟ <Link to={clientAuthPath('/login', clientDestination)}>تسجيل الدخول <ArrowLeft size={15}/></Link></span></header>
      {authRetryNotice && <div className="auth-entry-recovery">{authRetryNotice}</div>}
      <header className="registration-intro"><h1 ref={registrationHeadingRef} tabIndex={-1} id="registration-title">إنشاء حساب</h1><p>من حسابك، شوف الباقات والأسعار، اختَر الخدمة المناسبة، واحجز مواعيد التصوير المتاحة. وبعد الاشتراك، تابع مواعيدك ورصيد ساعاتك من نفس المكان</p></header>
      <div className="registration-grid">
        <section className="registration-form-card" aria-labelledby="registration-title">
          {error && <div role={success ? 'status' : 'alert'} className={success ? 'registration-success' : 'registration-error'}>{success && <CheckCircle2 aria-hidden="true"/>}{error}</div>}
          {success ? <Link className="registration-primary" to={clientAuthPath('/login', clientDestination)}>تسجيل الدخول <ArrowLeft aria-hidden="true"/></Link> : <form onSubmit={submit} aria-busy={busy}>
            <fieldset className="registration-form-fields" disabled={busy}>
              <legend className="registration-sr-only">بيانات حساب العميل</legend>
              <p className="registration-name-hint" id="register-name-hint">اكتب اسمك الثلاثي زي ما هيظهر في حجوزاتك</p>
              <div className="registration-fields">
                <label htmlFor="register-first_name">الاسم الأول<input id="register-first_name" name="first_name" aria-describedby="register-name-hint" required autoComplete="given-name" maxLength="50" value={form.first_name} onChange={e => patch('first_name', e.target.value)}/></label>
                <label htmlFor="register-second_name">الاسم الأوسط<input id="register-second_name" name="second_name" aria-describedby="register-name-hint" required autoComplete="additional-name" maxLength="50" value={form.second_name} onChange={e => patch('second_name', e.target.value)}/></label>
                <label htmlFor="register-last_name">الاسم الأخير<input id="register-last_name" name="last_name" aria-describedby="register-name-hint" required autoComplete="family-name" maxLength="50" value={form.last_name} onChange={e => patch('last_name', e.target.value)}/></label>
                <label htmlFor="register-phone">رقم واتساب<input id="register-phone" name="phone" aria-describedby="register-phone-hint" required type="tel" inputMode="tel" autoComplete="tel" pattern="[+0-9 \(\)\-]{8,24}" maxLength="24" dir="ltr" placeholder="01xxxxxxxxx" value={form.phone} onChange={e => patch('phone', normalizeRegistrationDigits(e.target.value))}/><small id="register-phone-hint">هتستخدم الرقم ده لتسجيل الدخول ومتابعة حجوزاتك</small></label>
                <label htmlFor="register-job" className="registration-full">الوظيفة<input id="register-job" name="job" required maxLength="160" autoComplete="organization-title" value={form.job} onChange={e => patch('job', e.target.value)}/></label>
                <label htmlFor="register-password">كلمة المرور<input id="register-password" name="password" required type="password" autoComplete="new-password" minLength="6" maxLength="128" dir="ltr" aria-describedby="register-password-hint" value={form.password} onChange={e => patch('password', e.target.value)}/><small id="register-password-hint">6 خانات على الأقل.</small></label>
                <label htmlFor="register-password-confirmation">تأكيد كلمة المرور<input ref={confirmationRef} id="register-password-confirmation" name="password_confirmation" required type="password" autoComplete="new-password" minLength="6" maxLength="128" dir="ltr" value={form.password_confirmation} onChange={e => patch('password_confirmation', e.target.value)}/></label>
              </div>
              <div className="registration-honeypot" aria-hidden="true"><label htmlFor="register-website">Website<input id="register-website" name="website" value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off"/></label></div>
              <RegistrationBotCheck key={botRevision} onPayload={setBotPayload}/>
              <button type="submit" className="registration-primary" disabled={busy || !botPayload}>{busy ? 'جارٍ إنشاء حسابك…' : 'إنشاء حساب'}<ArrowLeft aria-hidden="true"/></button>
            </fieldset>
          </form>}
        </section>

      </div>
      <footer className="registration-site-footer">Multi Task Agency · مساحتك لصناعة المحتوى.</footer>
      <PromotionGiftLauncher registration promotions={giftPromotions.items} serverOffset={giftPromotions.serverOffset} onAction={focusRegistration}/>
    </div>
    <ClientSupport auth />
  </main>;
}
