import { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { dataClient } from '../dataClient';
import { CLIENT_PASSWORD_HINT, CLIENT_PASSWORD_MAX_LENGTH, CLIENT_PASSWORD_MIN_LENGTH, isValidClientPassword } from '../lib/clientPasswordPolicy';
import './ClientSecuritySettings.css';

const emptyForm = () => ({ current_password: '', password: '', confirm_password: '' });

export default function ClientSecuritySettings() {
  const [form, setForm] = useState(emptyForm);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState({ busy: false, error: '', success: '' });
  const checks = useMemo(() => ({ valid: isValidClientPassword(form.password), match: Boolean(form.confirm_password) && form.password === form.confirm_password }), [form]);
  const update = (field, value) => { setForm(current => ({ ...current, [field]: value })); setState(current => ({ ...current, error: '', success: '' })); };

  const submit = async event => {
    event.preventDefault(); setState({ busy: false, error: '', success: '' });
    if (!form.current_password) return setState({ busy: false, error: 'اكتب كلمة المرور الحالية.', success: '' });
    if (!checks.valid) return setState({ busy: false, error: 'اكتب كلمة مرور جديدة من 6 خانات على الأقل.', success: '' });
    if (!checks.match) return setState({ busy: false, error: 'تأكيد كلمة المرور غير مطابق.', success: '' });
    setState({ busy: true, error: '', success: '' });
    const { error } = await dataClient.auth.updateUser({ password: form.password, currentPassword: form.current_password, confirmPassword: form.confirm_password });
    setForm(emptyForm()); setVisible(false);
    if (error) return setState({ busy: false, error: error.message || 'تعذر تغيير كلمة المرور.', success: '' });
    setState({ busy: false, error: '', success: 'تم تغيير كلمة المرور وتأمين جلستك الحالية. تم إنهاء الجلسات الأخرى.' });
  };

  return <section className="client-security-view client-view" aria-labelledby="client-security-title">
    <header className="client-security-view__head"><span><ShieldCheck /></span><div><p>إعدادات الحساب</p><h2 id="client-security-title">الأمان</h2><small>غيّر كلمة مرورك من هنا. لن نعرضها أو نحفظها على جهازك.</small></div></header>
    <form className="client-security-form" onSubmit={submit} noValidate>
      <label htmlFor="client-current-password">كلمة المرور الحالية</label><div className="client-security-field"><KeyRound /><input id="client-current-password" autoComplete="current-password" type={visible ? 'text' : 'password'} value={form.current_password} onChange={event => update('current_password', event.target.value)} maxLength={CLIENT_PASSWORD_MAX_LENGTH} dir="ltr" required /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'} aria-pressed={visible}>{visible ? <EyeOff /> : <Eye />}</button></div>
      <label htmlFor="client-new-password">كلمة المرور الجديدة</label><div className="client-security-field"><KeyRound /><input id="client-new-password" autoComplete="new-password" type={visible ? 'text' : 'password'} value={form.password} onChange={event => update('password', event.target.value)} minLength={CLIENT_PASSWORD_MIN_LENGTH} maxLength={CLIENT_PASSWORD_MAX_LENGTH} dir="ltr" required /></div>
      <label htmlFor="client-confirm-password">تأكيد كلمة المرور الجديدة</label><div className="client-security-field"><Check /><input id="client-confirm-password" autoComplete="new-password" type={visible ? 'text' : 'password'} value={form.confirm_password} onChange={event => update('confirm_password', event.target.value)} maxLength={CLIENT_PASSWORD_MAX_LENGTH} dir="ltr" required /></div>
      <ul className="client-security-rules" aria-label="متطلبات كلمة المرور"><li className={checks.valid ? 'complete' : ''}><Check />{CLIENT_PASSWORD_HINT}</li><li className={checks.match ? 'complete' : ''}><Check />التأكيد مطابق</li></ul>
      {state.error && <p className="client-security-message client-security-message--error" role="alert">{state.error}</p>}
      {state.success && <p className="client-security-message client-security-message--success" role="status">{state.success}</p>}
      <button className="client-security-submit" type="submit" disabled={state.busy}>{state.busy ? 'جارٍ تغيير كلمة المرور…' : 'تغيير كلمة المرور'}</button>
    </form>
  </section>;
}
