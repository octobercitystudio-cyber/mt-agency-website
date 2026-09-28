import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, Copy, Download } from 'lucide-react';
import { dataClient } from '../dataClient';
import './OwnerSecuritySettings.css';

export default function OwnerSecuritySettings({ preview = false }) {
  const [state, setState] = useState(null);
  const [mode, setMode] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (preview) return;
    let current = true;
    dataClient.request('/auth/owner/mfa').then(({ data, error: issue }) => {
      if (!current) return;
      if (issue) setError('تعذر مراجعة حماية الحساب. حدّث الصفحة وحاول مجددًا.'); else setState(data);
    });
    return () => { current = false; };
  }, [preview]);
  const cancel = () => { setMode(''); setPassword(''); setCode(''); setSetup(null); setError(''); };
  const submit = async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const action = mode === 'disable' ? 'disable' : setup ? 'enable' : 'setup';
      const { data, error: issue } = await dataClient.request(`/auth/owner/mfa/${action}`, { method: 'POST', body: JSON.stringify({ password, code }) });
      if (issue) throw issue;
      if (action === 'setup') {
        const qr = await QRCode.toDataURL(data.uri, { width: 240, margin: 2 });
        setSetup({ ...data, qr }); setCode('');
      } else {
        setState({ enabled: data.enabled, recovery_remaining: data.recovery_codes?.length || 0 });
        setCodes(data.recovery_codes || []); cancel();
        setMessage(data.enabled ? 'تم تفعيل التحقق بخطوتين. احفظ رموز الاسترداد الآن.' : 'تم إيقاف التحقق بخطوتين.');
      }
    } catch (issue) { setError(issue.message || 'تعذر حفظ إعداد الأمان. حاول مجددًا.'); }
    finally { setBusy(false); }
  };
  const download = () => {
    const blob = new Blob(['MTA — رموز استرداد حساب المالك\nكل رمز يُستخدم مرة واحدة فقط. احتفظ بها في مكان آمن.\n\n'+codes.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');link.href=url;link.download='MTA-recovery-codes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="setting-section owner-security" aria-labelledby="owner-security-title">
    <header><ShieldCheck/><div><h2 id="owner-security-title">أمان حساب المالك</h2><p>التحقق بخطوتين يضيف كودًا من تطبيق المصادقة عند تسجيل الدخول. الأجهزة المحفوظة تستمر في الدخول كالمعتاد.</p></div></header>
    {preview ? <p>إعداد التحقق بخطوتين متاح لحساب المالك على الموقع الفعلي.</p> : <>
      {state && <p className={state.enabled ? 'owner-security-on' : ''}><strong>{state.enabled ? 'التحقق بخطوتين مفعّل' : 'التحقق بخطوتين غير مفعّل'}</strong>{state.enabled && ` · ${state.recovery_remaining} رموز استرداد متبقية`}</p>}
      {error && <p role="alert" className="owner-security-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {codes.length > 0 ? <div className="owner-security-recovery"><h3>احفظ رموز الاسترداد قبل المغادرة</h3><p>تظهر مرة واحدة فقط. كل رمز بديل لكود التطبيق ويُستخدم مرة واحدة؛ لا تشاركه مع أي شخص.</p><pre dir="ltr">{codes.join('\n')}</pre><div className="owner-security-actions"><button type="button" onClick={download}><Download/> تحميل الرموز</button><button type="button" onClick={() => { setCodes([]); setMessage('تم تفعيل حماية الحساب.'); }}>حفظت الرموز في مكان آمن</button></div></div> : mode ? <form onSubmit={submit}>
        <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required /></label>
        {setup && <div className="owner-security-setup"><h3>اربط تطبيق المصادقة</h3><p>افتح تطبيق المصادقة واختر إضافة حساب ثم امسح الرمز. من نفس الموبايل يمكنك إدخال مفتاح الإعداد يدويًا واختيار «يعتمد على الوقت».</p><img src={setup.qr} width="240" height="240" alt="رمز ربط تطبيق المصادقة بحساب المالك"/><code dir="ltr">{setup.secret}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(setup.secret); setMessage('تم نسخ مفتاح الإعداد.'); } catch { setMessage('يمكنك تحديد مفتاح الإعداد ونسخه يدويًا.'); } }}><Copy/> نسخ مفتاح الإعداد</button><p>الإعداد صالح لمدة 10 دقائق.</p></div>}
        {(setup || mode === 'disable') && <label>{mode === 'disable' ? 'كود المصادقة أو رمز استرداد' : 'الكود المكوّن من 6 أرقام'}<input type="text" autoComplete="one-time-code" dir="ltr" maxLength={40} value={code} onChange={event => setCode(event.target.value)} disabled={busy} required /></label>}
        <div className="owner-security-actions"><button type="submit" disabled={busy}>{busy ? 'جارٍ التحقق…' : mode === 'disable' ? 'تأكيد إيقاف التحقق بخطوتين' : setup ? 'تأكيد الكود وتفعيل الحماية' : 'ربط تطبيق المصادقة'}</button><button type="button" onClick={cancel} disabled={busy}>إلغاء</button></div>
      </form> : state && <button type="button" onClick={() => { cancel(); setMode(state.enabled ? 'disable' : 'setup'); }}>{state.enabled ? 'إيقاف التحقق بخطوتين' : 'إعداد التحقق بخطوتين'}</button>}
    </>}
  </section>;
}
