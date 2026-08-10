import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dataClient } from '../dataClient';
import { CLIENT_PASSWORD_HINT, CLIENT_PASSWORD_MAX_LENGTH, CLIENT_PASSWORD_MIN_LENGTH, isValidClientPassword } from '../lib/clientPasswordPolicy';
import './ForcedPasswordChange.css';

export default function ForcedPasswordChange() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const navigate = useNavigate();
  const submit = async event => {
    event.preventDefault();
    if (!isValidClientPassword(password)) return setState({ busy: false, error: 'استخدم 6 خانات على الأقل لكلمة المرور.' });
    if (password !== confirmation) return setState({ busy: false, error: 'تأكيد كلمة المرور غير مطابق.' });
    setState({ busy: true, error: '' });
    const { error } = await dataClient.auth.updateUser({ password });
    if (error) return setState({ busy: false, error: error.message || 'تعذر تغيير كلمة المرور.' });
    navigate('/dashboard', { replace: true });
  };
  return <main className="forced-password" dir="rtl">
    <section className="forced-password__card" aria-labelledby="forced-password-title">
      <span className="forced-password__mark"><ShieldCheck aria-hidden="true" /></span>
      <p className="forced-password__eyebrow">خطوة أمان مطلوبة</p>
      <h1 id="forced-password-title">اختر كلمة مرور جديدة</h1>
      <p className="forced-password__intro">تم الدخول ببيانات مؤقتة. لحماية حسابك، أنشئ كلمة مرور خاصة بك قبل فتح لوحة العميل.</p>
      <form onSubmit={submit}>
        <label>كلمة المرور الجديدة<div className="forced-password__field"><KeyRound aria-hidden="true"/><input type="password" autoComplete="new-password" minLength={CLIENT_PASSWORD_MIN_LENGTH} maxLength={CLIENT_PASSWORD_MAX_LENGTH} value={password} onChange={event => setPassword(event.target.value)} required autoFocus /></div></label>
        <ul className="forced-password__rules" aria-label="شروط كلمة المرور"><li className={isValidClientPassword(password) ? 'is-valid' : ''}>{CLIENT_PASSWORD_HINT}</li></ul>
        <label>تأكيد كلمة المرور<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></label>
        {state.error && <p className="forced-password__error" role="alert">{state.error}</p>}
        <button type="submit" disabled={state.busy}>{state.busy ? 'جارٍ تأمين الحساب…' : 'حفظ وفتح لوحة العميل'}</button>
      </form>
    </section>
  </main>;
}
