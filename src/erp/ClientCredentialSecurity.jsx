import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Link, LogOut, Power, ShieldCheck, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { CLIENT_PASSWORD_HINT, CLIENT_PASSWORD_MAX_LENGTH, CLIENT_PASSWORD_MIN_LENGTH, isValidClientPassword } from '../lib/clientPasswordPolicy';
import { formatDateTime12 } from '../lib/businessFormat';
import './ClientCredentialSecurity.css';

const emptyPasswordForm = () => ({ new_password: '', confirm_password: '' });
const showDate = value => formatDateTime12(value);

export default function ClientCredentialSecurity({ clientId }) {
  const [meta, setMeta] = useState(null);
  const [state, setState] = useState({ loading: true, busy: '', loadError: '', actionError: '' });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const passwordButtonRef = useRef(null);
  const resetButtonRef = useRef(null);

  const closePassword = useCallback(() => {
    setPasswordOpen(false); setPasswordForm(emptyPasswordForm()); setPasswordVisible(false); setPasswordError(''); setPasswordSuccess(false);
  }, []);
  const closeReset = useCallback(() => { setResetResult(null); setCopied(false); }, []);
  const passwordDialogRef = useModalDialog(passwordOpen, closePassword, { returnFocusRef: passwordButtonRef, isolateBackground: true });
  const resetDialogRef = useModalDialog(Boolean(resetResult), closeReset, { returnFocusRef: resetButtonRef, isolateBackground: true });
  const checks = useMemo(() => ({
    length: isValidClientPassword(passwordForm.new_password),
    match: Boolean(passwordForm.confirm_password) && passwordForm.new_password === passwordForm.confirm_password,
  }), [passwordForm]);

  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true, loadError: '' }));
    const { data, error } = await dataClient.request(`/clients/${clientId}/credentials`);
    setState(current => ({ ...current, loading: false, loadError: error?.message || '' }));
    if (!error) setMeta(data);
  }, [clientId]);

  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, [load]);

  const act = async (name, path, body = {}) => {
    setState(current => ({ ...current, busy: name, actionError: '' }));
    const { data, error } = await dataClient.request(path, { method: 'POST', body: JSON.stringify(body) });
    setState(current => ({ ...current, busy: '', actionError: error?.message || '' }));
    if (error) return null;
    await load(); return data;
  };

  const savePassword = async event => {
    event.preventDefault(); event.stopPropagation(); setPasswordError('');
    if (!checks.length) return setPasswordError('اكتب كلمة مرور من 6 خانات على الأقل.');
    if (!checks.match) return setPasswordError('تأكيد كلمة المرور غير مطابق.');
    setState(current => ({ ...current, busy: 'password', actionError: '' }));
    const { error } = await dataClient.request(`/clients/${clientId}/credentials/password`, { method: 'POST', body: JSON.stringify({ password: passwordForm.new_password, confirm_password: passwordForm.confirm_password }) });
    setPasswordForm(emptyPasswordForm()); setPasswordVisible(false);
    setState(current => ({ ...current, busy: '', actionError: '' }));
    if (error) return setPasswordError(error.message || 'تعذر حفظ كلمة المرور. حاول مرة أخرى.');
    setPasswordSuccess(true); await load();
  };

  const issueReset = async () => {
    const result = await act('reset', `/clients/${clientId}/credentials/reset`);
    if (result) { setCopied(false); setResetResult(result); }
  };
  const copyReset = async () => {
    if (!resetResult?.reset_url) return;
    await navigator.clipboard.writeText(resetResult.reset_url); setCopied(true);
  };

  const hasPassword = meta?.has_password === true;
  const accessEnabled = meta?.access_enabled === true;
  return <section className="credential-security" aria-labelledby="credential-security-title">
    <header className="credential-security__head">
      <span className="credential-security__icon"><ShieldCheck aria-hidden="true" /></span>
      <div className="credential-security__heading"><h3 id="credential-security-title">الدخول والأمان</h3><p className={`credential-security__summary credential-security__summary--${accessEnabled ? 'enabled' : 'disabled'}`}>{accessEnabled ? 'الدخول مفعّل' : 'الدخول موقوف'}</p></div>
      {!state.loading && <button type="button" className={`credential-toggle credential-toggle--${accessEnabled ? 'stop' : 'start'}`} disabled={Boolean(state.busy) || (!hasPassword && !accessEnabled)} onClick={() => window.confirm(accessEnabled ? 'إيقاف دخول العميل وإنهاء جلساته الحالية؟' : 'تفعيل دخول العميل الآن؟') && act('toggle', `/clients/${clientId}/credentials/toggle`, { enabled: !accessEnabled })}><Power />{accessEnabled ? 'إيقاف الدخول' : 'تفعيل الدخول'}</button>}
    </header>

    {state.loading ? <div className="credential-security__state" role="status">جارٍ تحميل حالة الحساب…</div>
      : state.loadError ? <div className="credential-security__state credential-security__state--error" role="alert">{state.loadError}<button type="button" onClick={load}>إعادة المحاولة</button></div>
      : <>
        <dl className="credential-security__facts"><div><dt>كلمة المرور</dt><dd>{hasPassword ? 'معيّنة' : 'غير معيّنة'}</dd></div><div><dt>آخر دخول</dt><dd>{showDate(meta.last_login_at)}</dd></div><div><dt>الجلسات النشطة</dt><dd>{meta.active_sessions ?? 0}</dd></div></dl>
        {meta.must_change_password && <p className="credential-security__legacy" role="status">يحتاج العميل لتحديث كلمة المرور</p>}
        {meta.reset_pending && <p className="credential-security__reset-pending"><Link /> يوجد رابط إعادة تعيين صالح حتى {showDate(meta.reset_expires_at)}. إنشاء رابط جديد يلغي السابق.</p>}
        <div className="credential-security__actions">
          <button ref={passwordButtonRef} type="button" className="credential-action credential-action--primary" disabled={Boolean(state.busy)} onClick={() => { setPasswordOpen(true); setPasswordError(''); setPasswordSuccess(false); }}><KeyRound />{hasPassword ? 'تغيير كلمة المرور' : 'تعيين كلمة المرور'}</button>
          <button ref={resetButtonRef} type="button" className="credential-action" disabled={!hasPassword || Boolean(state.busy)} onClick={issueReset}><Link />{state.busy === 'reset' ? 'جارٍ إنشاء الرابط…' : 'إنشاء رابط إعادة تعيين'}</button>
          <button type="button" className="credential-action" disabled={!hasPassword || !Number(meta.active_sessions) || Boolean(state.busy)} onClick={() => window.confirm('هل تريد إنهاء جلسات العميل الحالية؟') && act('revoke', `/clients/${clientId}/credentials/sessions/revoke`)}><LogOut />إنهاء الجلسات</button>
        </div>
        {state.actionError && <div className="credential-security__state credential-security__state--error" role="alert">{state.actionError}</div>}
      </>}

    {passwordOpen && <div className="credential-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && closePassword()}><section ref={passwordDialogRef} className="credential-dialog" role="dialog" aria-modal="true" aria-labelledby="credential-password-title">
      <button type="button" className="credential-dialog__close" onClick={closePassword} aria-label="إغلاق ومسح حقول كلمة المرور"><X /></button>
      {passwordSuccess ? <div className="credential-dialog__success" role="status"><span><Check /></span><h3 id="credential-password-title">تم تغيير كلمة المرور</h3><p>تم تغيير كلمة المرور وإنهاء جلسات العميل. حالة الدخول لم تتغير.</p><button type="button" className="credential-dialog__submit" onClick={closePassword}>إغلاق</button></div>
        : <form onSubmit={savePassword} noValidate><span className="credential-dialog__mark"><KeyRound /></span><h3 id="credential-password-title">{hasPassword ? 'تغيير كلمة مرور العميل' : 'تعيين كلمة مرور للعميل'}</h3><p>اكتب الكلمة الجديدة فقط. عند الحفظ سيتم إنهاء جلسات العميل الحالية.</p>
          {passwordError && <div className="credential-dialog__error" role="alert">{passwordError}</div>}
          <label htmlFor="owner-client-new-password">كلمة المرور الجديدة</label><div className="credential-password-input"><input data-dialog-initial id="owner-client-new-password" type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" minLength={CLIENT_PASSWORD_MIN_LENGTH} maxLength={CLIENT_PASSWORD_MAX_LENGTH} value={passwordForm.new_password} onChange={event => setPasswordForm(current => ({ ...current, new_password: event.target.value }))} dir="ltr" required /><button type="button" onClick={() => setPasswordVisible(value => !value)} aria-label={passwordVisible ? 'إخفاء كلمة المرور الجديدة' : 'إظهار كلمة المرور الجديدة'} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff /> : <Eye />}</button></div>
          <label htmlFor="owner-client-confirm-password">تأكيد كلمة المرور</label><div className="credential-password-input"><input id="owner-client-confirm-password" type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" maxLength={CLIENT_PASSWORD_MAX_LENGTH} value={passwordForm.confirm_password} onChange={event => setPasswordForm(current => ({ ...current, confirm_password: event.target.value }))} dir="ltr" required /></div>
          <ul className="credential-dialog__checks" aria-label="متطلبات كلمة المرور"><li className={checks.length ? 'complete' : ''}><Check />{CLIENT_PASSWORD_HINT}</li><li className={checks.match ? 'complete' : ''}><Check />التأكيد مطابق</li></ul>
          <footer><button type="button" onClick={closePassword}>إلغاء</button><button type="submit" className="credential-dialog__submit" disabled={state.busy === 'password'}>{state.busy === 'password' ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</button></footer>
        </form>}
    </section></div>}

    {resetResult && <div className="credential-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && closeReset()}><section ref={resetDialogRef} className="credential-dialog credential-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="credential-reset-title">
      <button type="button" className="credential-dialog__close" onClick={closeReset} aria-label="إغلاق ومسح رابط إعادة التعيين"><X /></button><span className="credential-dialog__mark"><Link /></span><h3 id="credential-reset-title">تم إنشاء رابط إعادة تعيين</h3><p>تم إنشاء رابط إعادة تعيين صالح لمدة 30 دقيقة.</p><p className="credential-reset-dialog__warning">انسخ الرابط وأرسله للعميل عبر وسيلة آمنة. سيظهر هنا مرة واحدة فقط، وإصدار رابط جديد يلغي السابق.</p>
      <div className="credential-reset-dialog__link"><input data-dialog-initial readOnly dir="ltr" value={resetResult.reset_url || ''} aria-label="رابط إعادة تعيين كلمة المرور" /><button type="button" onClick={copyReset}><Copy />{copied ? 'تم النسخ' : 'نسخ'}</button></div><small>ينتهي في {showDate(resetResult.expires_at)}</small><button type="button" className="credential-dialog__submit" onClick={closeReset}>تم، إغلاق</button>
    </section></div>}
  </section>;
}
