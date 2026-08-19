import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { dataClient } from '../dataClient';
import { activateDemoMode } from '../lib/demoDataClient';
import { CLIENT_PASSWORD_HINT, CLIENT_PASSWORD_MAX_LENGTH, CLIENT_PASSWORD_MIN_LENGTH, isValidClientPassword } from '../lib/clientPasswordPolicy';
import { acquireResetFragment, clearResetFragment, completeResetAttempt, scheduleResetFragmentRelease } from '../lib/resetPasswordFlow';
import './ResetPassword.css';

const invalidMessage = 'هذا الرابط غير صالح أو انتهت مدته. اطلب رابطًا جديدًا من إدارة الشركة.';

export default function ResetPassword() {
  const tokenRef = useRef('');
  const [phase, setPhase] = useState('checking');
  const [form, setForm] = useState({ password: '', confirm_password: '' });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const validationRevision = useRef(0);

  const validateToken = useCallback(async token => {
    const revision = ++validationRevision.current;
    setPhase('checking'); setError('');
    if (!token || token.length < 40) {
      clearResetFragment(token); tokenRef.current = '';
      if (revision === validationRevision.current) setPhase('invalid');
      return;
    }
    await dataClient.auth.getSession();
    const { error: validationError } = await dataClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) });
    if (revision !== validationRevision.current) return;
    if (!validationError) { setPhase('ready'); return; }
    if (validationError.code === 'invalid_reset_link') {
      clearResetFragment(token); tokenRef.current = ''; setPhase('invalid'); return;
    }
    setError('تعذر التحقق من الرابط الآن. حاول مرة أخرى.'); setPhase('retry');
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1') activateDemoMode('public_reset');
    const token = acquireResetFragment(window.location, window.history);
    tokenRef.current = token;
    const validationTimer = window.setTimeout(() => validateToken(token), 0);
    return () => { window.clearTimeout(validationTimer); validationRevision.current += 1; scheduleResetFragmentRelease(token); };
  }, [validateToken]);

  const submit = async event => {
    event.preventDefault(); setError('');
    if (!isValidClientPassword(form.password)) return setError('اكتب كلمة مرور من 6 خانات على الأقل.');
    if (form.password !== form.confirm_password) return setError('تأكيد كلمة المرور غير مطابق.');
    setPhase('saving');
    const token = tokenRef.current;
    const result = await completeResetAttempt(dataClient, token, form);
    setForm({ password: '', confirm_password: '' }); setVisible(false);
    if (result.kind === 'invalid') { clearResetFragment(token); tokenRef.current = ''; setPhase('invalid'); return; }
    if (result.kind !== 'success') {
      setError(result.kind === 'correctable' ? result.error?.message || 'راجع كلمة المرور وحاول مرة أخرى.' : 'تعذر حفظ كلمة المرور الآن. حاول مرة أخرى.');
      setPhase('ready'); return;
    }
    clearResetFragment(token); tokenRef.current = '';
    setPhase('success'); window.setTimeout(() => navigate('/login', { replace: true }), 2500);
  };

  return <main className="reset-password" dir="rtl"><section className="reset-password__card" aria-labelledby="reset-password-title">
    <span className="reset-password__seal"><ShieldCheck /></span>
    {phase === 'checking' && <div role="status"><h1 id="reset-password-title">جارٍ فحص الرابط…</h1><p>لحظة واحدة للتأكد من صلاحية رابط إعادة التعيين.</p></div>}
    {phase === 'retry' && <div role="alert"><h1 id="reset-password-title">تعذر التحقق الآن</h1><p>{error}</p><button className="reset-password__submit" type="button" onClick={() => validateToken(tokenRef.current)}>إعادة المحاولة</button></div>}
    {phase === 'invalid' && <div role="alert"><h1 id="reset-password-title">تعذر فتح الرابط</h1><p>{invalidMessage}</p><Link to="/login">العودة لتسجيل الدخول</Link></div>}
    {phase === 'success' && <div className="reset-password__success" role="status"><CheckCircle2 /><h1 id="reset-password-title">تم تغيير كلمة المرور</h1><p>يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة. سيتم توجيهك إلى صفحة الدخول.</p><Link to="/login">تسجيل الدخول الآن</Link></div>}
    {(phase === 'ready' || phase === 'saving') && <><p className="reset-password__eyebrow">حماية حسابك</p><h1 id="reset-password-title">اختر كلمة مرور جديدة</h1><p>اكتب الكلمة الجديدة والتأكيد. لن نطلب منك أي كلمة سابقة.</p><form onSubmit={submit} noValidate>
      <label htmlFor="reset-new-password">كلمة المرور الجديدة</label><div className="reset-password__field"><KeyRound /><input id="reset-new-password" autoFocus type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={CLIENT_PASSWORD_MIN_LENGTH} maxLength={CLIENT_PASSWORD_MAX_LENGTH} value={form.password} onChange={event => { setError(''); setForm(current => ({ ...current, password: event.target.value })); }} dir="ltr" required /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={visible}>{visible ? <EyeOff /> : <Eye />}</button></div>
      <label htmlFor="reset-confirm-password">تأكيد كلمة المرور</label><div className="reset-password__field reset-password__field--plain"><KeyRound /><input id="reset-confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" maxLength={CLIENT_PASSWORD_MAX_LENGTH} value={form.confirm_password} onChange={event => { setError(''); setForm(current => ({ ...current, confirm_password: event.target.value })); }} dir="ltr" required /></div>
      <small>{CLIENT_PASSWORD_HINT}</small>{error && <p className="reset-password__error" role="alert">{error}</p>}<button className="reset-password__submit" disabled={phase === 'saving'}>{phase === 'saving' ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</button>
    </form></>}
  </section></main>;
}
