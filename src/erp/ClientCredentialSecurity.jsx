import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, LogOut, Power, ShieldCheck, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { CLIENT_PASSWORD_HINT, CLIENT_PASSWORD_MAX_LENGTH, CLIENT_PASSWORD_MIN_LENGTH, isValidClientPassword } from '../lib/clientPasswordPolicy';
import './ClientCredentialSecurity.css';

const emptyPasswordForm = () => ({ new_password: '', confirm_password: '', require_change: false });
const showDate = value => value ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T'))) : '—';
const passwordChecks = form => ({
  length: isValidClientPassword(form.new_password),
  match: Boolean(form.confirm_password) && form.new_password === form.confirm_password,
});

export default function ClientCredentialSecurity({ clientId }) {
  const [meta, setMeta] = useState(null);
  const [state, setState] = useState({ loading: true, busy: '', loadError: '', actionError: '' });
  const [handoff, setHandoff] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const issueButtonRef = useRef(null);
  const passwordButtonRef = useRef(null);
  const checks = useMemo(() => passwordChecks(passwordForm), [passwordForm]);

  const clearPasswordDialog = useCallback(() => {
    setPasswordForm(emptyPasswordForm());
    setPasswordVisible(false);
    setPasswordError('');
    setPasswordSuccess(null);
  }, []);
  const closePassword = useCallback(() => { setPasswordOpen(false); clearPasswordDialog(); }, [clearPasswordDialog]);
  const closeHandoff = useCallback(() => setHandoff(null), []);
  const passwordDialogRef = useModalDialog(passwordOpen, closePassword, { returnFocusRef: passwordButtonRef });
  const handoffRef = useModalDialog(Boolean(handoff), closeHandoff, { returnFocusRef: issueButtonRef });

  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true, loadError: '' }));
    const { data, error } = await dataClient.request(`/clients/${clientId}/credentials`);
    setState(current => ({ ...current, loading: false, loadError: error?.message || '' }));
    if (!error) setMeta(data);
  }, [clientId]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = async (name, path, body = {}) => {
    setState(current => ({ ...current, busy: name, actionError: '' }));
    const { data, error } = await dataClient.request(path, { method: 'POST', body: JSON.stringify(body) });
    setState(current => ({ ...current, busy: '', actionError: error?.message || '' }));
    if (error) return;
    if (name === 'temporary') setHandoff(data);
    await load();
  };

  const openPassword = () => {
    clearPasswordDialog();
    setPasswordOpen(true);
  };

  const savePassword = async event => {
    event.preventDefault();
    event.stopPropagation();
    setPasswordError('');
    if (!checks.length) { setPasswordError('اكتب كلمة مرور من 6 خانات على الأقل.'); return; }
    if (!checks.match) { setPasswordError('تأكيد كلمة المرور غير مطابق.'); return; }
    setState(current => ({ ...current, busy: 'password', actionError: '' }));
    const payload = { ...passwordForm };
    const { data, error } = await dataClient.request(`/clients/${clientId}/credentials/password`, { method: 'POST', body: JSON.stringify(payload) });
    setPasswordForm(emptyPasswordForm());
    setPasswordVisible(false);
    setState(current => ({ ...current, busy: '', actionError: '' }));
    if (error) { setPasswordError(error.message || 'تعذر حفظ كلمة المرور. حاول مرة أخرى.'); return; }
    setPasswordSuccess({ accessEnabled: data.access_enabled === true });
    await load();
  };

  const copy = async () => {
    if (!handoff?.temporary_password) return;
    await navigator.clipboard.writeText(handoff.temporary_password);
    setHandoff(current => ({ ...current, copied: true }));
  };

  const hasPassword = meta?.has_password === true;
  const accessEnabled = meta?.access_enabled === true;

  return <section className="credential-security" aria-labelledby="credential-security-title">
    <header className="credential-security__head">
      <span className="credential-security__icon"><ShieldCheck aria-hidden="true" /></span>
      <div><h3 id="credential-security-title">الدخول والأمان</h3><p>كلمة المرور ومفتاح تشغيل البوابة مستقلان. لا يمكن عرض أي كلمة مرور بعد حفظها.</p></div>
    </header>

    {state.loading ? <div className="credential-security__state" role="status">جارٍ تحميل حالة الحساب…</div>
      : state.loadError ? <div className="credential-security__state credential-security__state--error" role="alert">{state.loadError}<button type="button" onClick={load}>إعادة المحاولة</button></div>
      : <>
        <dl className="credential-security__facts">
          <div className={`credential-security__fact credential-security__fact--${accessEnabled ? 'enabled' : 'disabled'}`}><dt>حالة دخول العميل</dt><dd><span className={`credential-chip credential-chip--${accessEnabled ? 'enabled' : 'disabled'}`}>{accessEnabled ? 'الدخول مفعّل' : 'الدخول موقوف'}</span></dd></div>
          <div><dt>كلمة المرور</dt><dd><span className={`credential-chip credential-chip--${hasPassword ? 'active' : 'no_account'}`}>{hasPassword ? 'كلمة المرور مُعيّنة' : 'لا توجد كلمة مرور'}</span></dd></div>
          <div><dt>التغيير عند أول دخول</dt><dd><span className={`credential-chip credential-chip--${meta.must_change_password ? 'change_required' : 'active'}`}>{meta.must_change_password ? 'مطلوب' : 'غير مطلوب'}</span></dd></div>
          <div><dt>آخر تغيير لكلمة المرور</dt><dd>{showDate(meta.password_changed_at)}</dd></div>
          <div><dt>الجلسات النشطة</dt><dd>{meta.active_sessions ?? 0}</dd></div>
          <div><dt>آخر دخول</dt><dd>{showDate(meta.last_login_at)}</dd></div>
        </dl>

        <div className="credential-security__control-grid">
          <section className="credential-security__key-zone" aria-labelledby="credential-key-title">
            <div className="credential-security__zone-head"><KeyRound aria-hidden="true" /><div><h4 id="credential-key-title">مفتاح الدخول</h4><p>التعيين يغيّر كلمة المرور وينهي الجلسات، لكنه لا يشغّل أو يوقف الدخول.</p></div></div>
            <div className="credential-security__actions">
              <button ref={passwordButtonRef} type="button" className="credential-action credential-action--primary" disabled={Boolean(state.busy)} onClick={openPassword}><KeyRound />{hasPassword ? 'تغيير كلمة المرور' : 'تعيين كلمة مرور جديدة'}</button>
              <button ref={issueButtonRef} type="button" className="credential-action" disabled={Boolean(state.busy)} onClick={() => act('temporary', `/clients/${clientId}/credentials/temporary`)}><KeyRound />{state.busy === 'temporary' ? 'جارٍ الإنشاء…' : 'إنشاء كلمة مرور مؤقتة'}</button>
              <button type="button" className="credential-action" disabled={!hasPassword || Boolean(state.busy)} onClick={() => window.confirm('هل تريد إنهاء كل جلسات العميل النشطة؟') && act('revoke', `/clients/${clientId}/credentials/sessions/revoke`)}><LogOut />إنهاء كل الجلسات</button>
            </div>
          </section>

          <section className={`credential-security__access-zone credential-security__access-zone--${accessEnabled ? 'enabled' : 'disabled'}`} aria-labelledby="credential-access-title">
            <div className="credential-security__zone-head"><Power aria-hidden="true" /><div><h4 id="credential-access-title">تشغيل دخول العميل</h4><p>{accessEnabled ? 'العميل يستطيع تسجيل الدخول بكلمة المرور المُعيّنة.' : 'لن يستطيع العميل الدخول حتى التفعيل الصريح من هنا.'}</p></div></div>
            <span className={`credential-access-status credential-access-status--${accessEnabled ? 'enabled' : 'disabled'}`}>{accessEnabled ? 'مفعّل الآن' : 'موقوف الآن'}</span>
            <button type="button" className={`credential-action credential-action--toggle ${accessEnabled ? 'credential-action--danger' : 'credential-action--enable'}`} disabled={Boolean(state.busy)} onClick={() => window.confirm(accessEnabled ? 'إيقاف دخول العميل الآن وإنهاء كل جلساته؟' : 'تفعيل دخول العميل باستخدام كلمة المرور المُعيّنة؟') && act('toggle', `/clients/${clientId}/credentials/toggle`, { enabled: !accessEnabled })}><Power />{accessEnabled ? 'إيقاف دخول العميل' : 'تفعيل دخول العميل'}</button>
          </section>
        </div>
        {state.actionError && <div className="credential-security__state credential-security__state--error" role="alert">{state.actionError}</div>}
      </>}

    {passwordOpen && <div className="credential-password-backdrop" onMouseDown={event => event.target === event.currentTarget && closePassword()}>
      <section ref={passwordDialogRef} className="credential-password-dialog" role="dialog" aria-modal="true" aria-labelledby="credential-password-title">
        <button type="button" className="credential-dialog-close" onClick={closePassword} aria-label="إغلاق ومسح حقول كلمة المرور"><X /></button>
        {passwordSuccess ? <div className="credential-password-success" role="status">
          <span><Check aria-hidden="true" /></span><p className="credential-password-eyebrow">تم الحفظ بأمان</p><h3 id="credential-password-title">تم تحديث كلمة المرور</h3>
          <p>{passwordSuccess.accessEnabled ? 'دخول العميل ما زال مفعّلًا.' : 'دخول العميل ما زال موقوفًا.'} حفظ كلمة المرور لم يغيّر حالة الدخول، ولن تتغير إلا من زر التشغيل المستقل.</p>
          <button type="button" className="credential-password-submit" onClick={closePassword}>فهمت، إغلاق</button>
        </div> : <form onSubmit={savePassword} noValidate>
          <p className="credential-password-eyebrow">مفتاح جديد — دون كشف القديم</p><h3 id="credential-password-title">{hasPassword ? 'تغيير كلمة المرور' : 'تعيين كلمة مرور جديدة'}</h3>
          <p className="credential-password-intro">ستظهر الكلمة في هذه النافذة أثناء الكتابة فقط. بعد الحفظ لا يمكن استرجاعها أو عرضها.</p>
          {passwordError && <div className="credential-password-error" role="alert">{passwordError}</div>}
          <label htmlFor="owner-client-new-password">كلمة المرور الجديدة</label>
          <div className="credential-password-input">
            <input id="owner-client-new-password" type={passwordVisible ? 'text' : 'password'} value={passwordForm.new_password} onChange={event => setPasswordForm(current => ({ ...current, new_password: event.target.value }))} autoComplete="new-password" minLength={CLIENT_PASSWORD_MIN_LENGTH} maxLength={CLIENT_PASSWORD_MAX_LENGTH} spellCheck="false" dir="ltr" required />
            <button type="button" onClick={() => setPasswordVisible(value => !value)} aria-label={passwordVisible ? 'إخفاء كلمة المرور الجديدة' : 'إظهار كلمة المرور الجديدة'} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff /> : <Eye />}</button>
          </div>
          <label htmlFor="owner-client-confirm-password">تأكيد كلمة المرور الجديدة</label>
          <div className="credential-password-input">
            <input id="owner-client-confirm-password" type={passwordVisible ? 'text' : 'password'} value={passwordForm.confirm_password} onChange={event => setPasswordForm(current => ({ ...current, confirm_password: event.target.value }))} autoComplete="new-password" maxLength="128" spellCheck="false" dir="ltr" required />
          </div>
          <ul className="credential-password-checks" aria-label="متطلبات كلمة المرور">
            <li className={checks.length ? 'complete' : ''}><Check />{CLIENT_PASSWORD_HINT}</li>
            <li className={checks.match ? 'complete' : ''}><Check />التأكيد مطابق</li>
          </ul>
          <label className="credential-password-force"><input type="checkbox" checked={passwordForm.require_change} onChange={event => setPasswordForm(current => ({ ...current, require_change: event.target.checked }))} /><span>إلزام العميل بتغييرها عند أول دخول</span></label>
          <p className={`credential-password-access-note credential-password-access-note--${accessEnabled ? 'enabled' : 'disabled'}`}>{accessEnabled ? 'الدخول مفعّل وسيظل مفعّلًا بعد الحفظ.' : 'الدخول موقوف وسيظل موقوفًا بعد الحفظ حتى تفعّله بشكل منفصل.'}</p>
          <div className="credential-password-footer"><button type="button" className="credential-password-cancel" onClick={closePassword}>إلغاء</button><button type="submit" className="credential-password-submit" disabled={state.busy === 'password'}>{state.busy === 'password' ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</button></div>
        </form>}
      </section>
    </div>}

    {handoff && <div className="credential-handoff-backdrop" onMouseDown={event => event.target === event.currentTarget && closeHandoff()}>
      <div ref={handoffRef} className="credential-handoff" role="dialog" aria-modal="true" aria-labelledby="credential-handoff-title">
        <button type="button" className="credential-handoff__close" onClick={closeHandoff} aria-label="إغلاق ومسح كلمة المرور المؤقتة"><X /></button>
        <span className="credential-handoff__seal"><KeyRound aria-hidden="true" /></span>
        <p className="credential-handoff__eyebrow">تسليم آمن لمرة واحدة</p>
        <h3 id="credential-handoff-title">بيانات دخول العميل المؤقتة</h3>
        <p className="credential-handoff__warning">لن تظهر هذه البيانات مرة أخرى</p>
        <label>اسم المستخدم<input readOnly dir="ltr" value={handoff.login_identifier || ''} /></label>
        <label>كلمة المرور المؤقتة<div className="credential-handoff__secret"><code dir="ltr">{handoff.temporary_password}</code><button type="button" onClick={copy}><Copy />{handoff.copied ? 'تم النسخ' : 'نسخ'}</button></div></label>
        <p className="credential-handoff__expiry">صالحة حتى {showDate(handoff.expires_at)}، ويجب على العميل تغييرها بعد أول دخول.</p>
        {handoff.portal_access === 'disabled' && <p className="credential-handoff__disabled" role="status">دخول العميل ما زال معطلًا. فعّله بإجراء منفصل بعد إغلاق هذه النافذة.</p>}
        <button type="button" className="credential-handoff__done" onClick={closeHandoff}>تم التسليم وإغلاق النافذة</button>
      </div>
    </div>}
  </section>;
}
