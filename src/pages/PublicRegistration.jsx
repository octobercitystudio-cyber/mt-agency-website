import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, ShieldCheck, UserRound } from 'lucide-react';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import { normalizeRegistrationDigits } from '../lib/registrationPolicy';
import { safeUiError } from '../lib/uiError';
import RegistrationBotCheck from '../components/RegistrationBotCheck';
import { safeClientDestination, clientAuthPath } from '../lib/clientAuthDestination';
import './PublicRegistration.css';

const emptyForm = { name: '', phone: '', job: '', password: '', password_confirmation: '' };
const botErrors = ['bot_verification_required', 'bot_verification_failed', 'bot_verification_expired'];
const registrationError = error => {
  if (botErrors.includes(error?.code)) return 'أعد التحقق من أنك لست روبوتًا، ثم اضغط إنشاء حسابي. بياناتك محفوظة في النموذج.';
  if (error?.code === 'registration_rate_limited' || error?.status === 429) return 'محاولات التسجيل كثيرة حاليًا. انتظر قليلًا ثم حاول مرة أخرى.';
  return safeUiError(error, 'تعذر إنشاء الحساب. تأكد من الاتصال وحاول مرة أخرى.');
};

export default function PublicRegistration() {
  const { loginErp, currentUser } = useData();
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
  const patch = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (['client', 'applicant'].includes(currentUser?.role)) navigate(clientDestination, { replace: true });
  }, [clientDestination, currentUser, navigate]);
  const resetBot = () => { setBotPayload(''); setBotRevision(value => value + 1); };
  const submit = async event => {
    event.preventDefault();
    if (submissionRef.current || success) return;
    setError('');
    if (form.password !== form.password_confirmation) { setError('تأكيد كلمة المرور غير مطابق.'); confirmationRef.current?.focus(); return; }
    if (!botPayload) { setError('أكمل التحقق من أنك لست روبوتًا أولًا.'); return; }
    submissionRef.current = true; setBusy(true);
    let created = false;
    try {
      const response = await dataClient.request('/registration/complete', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim(), phone: form.phone.trim(), job: form.job.trim(), altcha: botPayload, website }) });
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

  return <main className="registration-page" dir="rtl">
    <div className="registration-shell">
      <header className="registration-topbar"><Link to="/" aria-label="الموقع الرئيسي"><img src="/logo.webp" alt="Multi Task Agency"/></Link><span>لديك حساب؟ <Link to={clientAuthPath('/login', clientDestination)}>تسجيل الدخول <ArrowLeft size={15}/></Link></span></header>
      <div className="registration-intro"><span className="registration-kicker">مساحتك في Multi Task</span><h1>حسابك جاهز لبداية جديدة.</h1><p>سجّل بياناتك مرة واحدة، ثم اختر باقتك ومواعيد تصويرك من حسابك.</p></div>
      <div className="registration-grid">
        <section className="registration-form-card" aria-labelledby="registration-title">
          <div className="registration-section-title"><span><UserRound aria-hidden="true"/></span><div><p>تسجيل فوري</p><h2 id="registration-title">نتعرف عليك</h2></div></div>
          {error && <div role={success ? 'status' : 'alert'} className={success ? 'registration-success' : 'registration-error'}>{success && <CheckCircle2 aria-hidden="true"/>}{error}</div>}
          {success ? <Link className="registration-primary" to={clientAuthPath('/login', clientDestination)}>تسجيل الدخول <ArrowLeft aria-hidden="true"/></Link> : <form onSubmit={submit} aria-busy={busy}>
            <p className="registration-explainer">بيانات بسيطة وحساب جاهز مباشرة. استخدم رقم واتساب للدخول إلى حسابك بعد التسجيل.</p>
            <fieldset className="registration-form-fields" disabled={busy}>
              <legend className="registration-sr-only">بيانات حساب العميل</legend>
              <div className="registration-fields">
                <label htmlFor="register-name">اسم العميل<input id="register-name" name="name" required autoComplete="name" minLength="2" maxLength="160" value={form.name} onChange={e => patch('name', e.target.value)}/></label>
                <label htmlFor="register-phone">رقم واتساب<input id="register-phone" name="phone" required type="tel" inputMode="tel" autoComplete="tel" pattern="[+0-9 \(\)\-]{8,24}" maxLength="24" dir="ltr" placeholder="01xxxxxxxxx" value={form.phone} onChange={e => patch('phone', normalizeRegistrationDigits(e.target.value))}/></label>
                <label htmlFor="register-job" className="registration-full">الوظيفة<input id="register-job" name="job" required maxLength="160" autoComplete="organization-title" value={form.job} onChange={e => patch('job', e.target.value)}/></label>
                <label htmlFor="register-password">كلمة المرور<input id="register-password" name="password" required type="password" autoComplete="new-password" minLength="6" maxLength="128" dir="ltr" aria-describedby="register-password-hint" value={form.password} onChange={e => patch('password', e.target.value)}/><small id="register-password-hint">6 خانات على الأقل.</small></label>
                <label htmlFor="register-password-confirmation">تأكيد كلمة المرور<input ref={confirmationRef} id="register-password-confirmation" name="password_confirmation" required type="password" autoComplete="new-password" minLength="6" maxLength="128" dir="ltr" value={form.password_confirmation} onChange={e => patch('password_confirmation', e.target.value)}/></label>
              </div>
              <div className="registration-honeypot" aria-hidden="true"><label htmlFor="register-website">Website<input id="register-website" name="website" value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off"/></label></div>
              <RegistrationBotCheck key={botRevision} onPayload={setBotPayload}/>
              <button type="submit" className="registration-primary" disabled={busy || !botPayload}>{busy ? 'جارٍ إنشاء حسابك…' : 'إنشاء حسابي'}<ArrowLeft aria-hidden="true"/></button>
            </fieldset>
            <p className="registration-bottom-note">يمكنك اختيار الخدمة والمواعيد لاحقًا من لوحة حسابك.</p>
          </form>}
        </section>
        <aside className="registration-summary"><span className="registration-summary-icon"><ShieldCheck aria-hidden="true"/></span><h2>حساب واحد،<br/>كل تفاصيل تصويرك.</h2><p>ابدأ حسابك الآن، واختر الخدمة ونسّق مواعيدك وقتما يناسبك.</p><ul><li><CheckCircle2 aria-hidden="true"/><div><strong>تسجيل فوري</strong><span>حسابك جاهز دون انتظار موافقة.</span></div></li><li><UserRound aria-hidden="true"/><div><strong>باقاتك في مكان واحد</strong><span>تابع الساعات المتاحة وتفاصيل باقتك.</span></div></li><li><CalendarDays aria-hidden="true"/><div><strong>حجز يناسب جدولك</strong><span>اختر مواعيدك وتابع حالة طلباتك بسهولة.</span></div></li></ul></aside>
      </div>
      <footer className="registration-site-footer">Multi Task Agency · مساحتك لصناعة المحتوى.</footer>
    </div>
  </main>;
}