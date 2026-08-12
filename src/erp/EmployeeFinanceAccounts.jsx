import { useCallback, useEffect, useRef, useState } from 'react';
import { BanknoteArrowUp, ChevronDown, ChevronUp, CircleDollarSign, ExternalLink, HandCoins, LoaderCircle, ReceiptText, RotateCcw, UserRound, WalletCards, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import { formatEGP, formatPaymentMethod } from '../lib/businessFormat';

const actionOptions = [
  { kind: 'out_of_pocket', label: 'دفع من جيبه', description: 'مصروف دفعه الموظف وتلتزم الشركة برده', icon: ReceiptText },
  { kind: 'advance_out', label: 'منح سلفة', description: 'مبلغ خرج من الشركة ويصبح مستحقًا على الموظف', icon: BanknoteArrowUp },
  { kind: 'advance_in', label: 'سداد سلفة', description: 'مبلغ أعاده الموظف إلى الشركة', icon: RotateCcw },
  { kind: 'settlement_out', label: 'سداد مستحقات', description: 'مبلغ ردّته الشركة للموظف', icon: HandCoins },
];

const kindLabels = { out_of_pocket: 'دفع من جيبه', advance_out: 'منح سلفة', advance_in: 'سداد سلفة', settlement_out: 'سداد مستحقات' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const requestKey = () => `ui_${Date.now()}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

function AccountStatus({ value }) {
  const amount = Number(value || 0); const tone = amount > 0 ? 'due' : amount < 0 ? 'advance' : 'settled';
  return <div className={`employee-finance-status ${tone}`}><span>{amount > 0 ? 'مستحق له' : amount < 0 ? 'عليه سلفة' : 'متزن'}</span><strong>{formatEGP(Math.abs(amount))}</strong></div>;
}

function MovementDialog({ account, kind, onClose, onSaved }) {
  const dialogRef = useRef(null); const triggerRef = useRef(null);
  const [form, setForm] = useState({ amount: '', date: today(), method: 'cash', detail: '', idempotency_key: requestKey() });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const action = actionOptions.find(item => item.kind === kind) || actionOptions[0];

  useEffect(() => {
    const trigger = triggerRef.current || document.activeElement; triggerRef.current = trigger;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current; dialog?.querySelector('input')?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])') || [])]; if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); trigger?.focus?.(); };
  }, [onClose, saving]);

  const submit = async event => {
    event.preventDefault(); setError('');
    if (!/^\d+(?:\.\d{1,2})?$/.test(form.amount) || Number(form.amount) <= 0) { setError('أدخل مبلغًا صحيحًا أكبر من صفر وبدقة قرشين كحد أقصى.'); return; }
    if (form.detail.trim().length < 3) { setError('اكتب بيانًا واضحًا للمعاملة.'); return; }
    setSaving(true);
    const result = await dataClient.request('/attendance/employee-accounts/movements', { method: 'POST', body: JSON.stringify({ ...form, employee_user_id: account.user.id, kind, detail: form.detail.trim() }) });
    if (result.error) { setError(result.error.message || 'تعذر حفظ المعاملة.'); setSaving(false); return; }
    onSaved(result.data); onClose();
  };

  return <div className="employee-finance-overlay" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <form ref={dialogRef} className="employee-finance-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-finance-dialog-title" onSubmit={submit}>
      <header><div><span>{action.description}</span><h3 id="employee-finance-dialog-title">{action.label} — {account.user.full_name}</h3></div><button type="button" onClick={onClose} disabled={saving} aria-label="إغلاق"><X /></button></header>
      <div className="employee-finance-form">
        {error && <p className="employee-finance-form-error" role="alert">{error}</p>}
        <label>المبلغ بالجنيه<input type="text" inputMode="decimal" autoComplete="off" value={form.amount} onChange={event => setForm(old => ({ ...old, amount: event.target.value }))} placeholder="0.00" required /></label>
        <label>تاريخ المعاملة<input type="date" value={form.date} onChange={event => setForm(old => ({ ...old, date: event.target.value }))} required /></label>
        <label>طريقة الدفع<select value={form.method} onChange={event => setForm(old => ({ ...old, method: event.target.value }))}><option value="cash">نقدي</option><option value="bank_transfer">تحويل بنكي</option><option value="instapay">إنستاباي</option><option value="vodafone_cash">فودافون كاش</option></select></label>
        <label className="wide">البيان والتفاصيل<textarea rows="3" maxLength="255" value={form.detail} onChange={event => setForm(old => ({ ...old, detail: event.target.value }))} placeholder="مثال: شراء مستلزمات تصوير من ماله الخاص" required /></label>
      </div>
      <footer><button type="button" onClick={onClose} disabled={saving}>إلغاء</button><button className="primary" disabled={saving}>{saving ? <><LoaderCircle className="spin" /> جارٍ الحفظ…</> : 'حفظ في الحضور والحسابات'}</button></footer>
    </form>
  </div>;
}

export default function EmployeeFinanceAccounts({ month, canManage }) {
  const [state, setState] = useState({ loading: true, error: '', accounts: [], unlinked: 0 });
  const [expanded, setExpanded] = useState({}); const [movement, setMovement] = useState(null); const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (!canManage) return;
    setState(old => ({ ...old, loading: true, error: '' }));
    const result = await dataClient.request(`/attendance/employee-accounts?month=${encodeURIComponent(month)}`, { method: 'GET' });
    if (result.error) setState({ loading: false, error: result.error.message || 'تعذر تحميل حسابات الموظفين.', accounts: [], unlinked: 0 });
    else setState({ loading: false, error: '', accounts: result.data?.accounts || [], unlinked: Number(result.data?.unlinked_legacy_count || 0) });
  }, [canManage, month]);

  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, [load]);
  if (!canManage) return null;

  return <section className="employee-finance-section" aria-labelledby="employee-finance-title">
    <header className="employee-finance-heading"><div><span>تسوية الموظفين</span><h2 id="employee-finance-title">حسابات أشرف ومروة</h2><p>كل مصروف شخصي أو سلفة أو سداد هنا يظهر بالقيد نفسه ورقمه في صفحة الحسابات.</p></div><WalletCards aria-hidden="true" /></header>
    <div className="employee-finance-live" aria-live="polite">{notice}</div>
    {state.loading ? <div className="employee-finance-state"><LoaderCircle className="spin" /> جارٍ تحميل الحسابات…</div> : state.error ? <div className="employee-finance-state error"><p>{state.error}</p><button onClick={load}>إعادة المحاولة</button></div> : state.accounts.length === 0 ? <div className="employee-finance-state"><UserRound /><p>لا توجد حسابات مطابقة لأشرف أو مروة في هذه المؤسسة.</p></div> : <div className="employee-finance-accounts">{state.accounts.map(account => {
      const transactions = account.selected_month?.transactions || []; const isOpen = Boolean(expanded[account.user.id]);
      return <article className="employee-finance-account" key={account.user.id}>
        <header><div className="employee-finance-person"><span><UserRound /></span><div><strong>{account.user.full_name}</strong><small>{account.user.role === 'owner' ? 'مالك' : 'مدير'}</small></div></div><AccountStatus value={account.net_due_to_employee} /></header>
        <dl className="employee-finance-breakdown"><div><dt>دفع من جيبه</dt><dd className="positive">{formatEGP(account.totals.out_of_pocket)}</dd></div><div><dt>سلف حصل عليها</dt><dd className="negative">{formatEGP(account.totals.advance_out)}</dd></div><div><dt>سدد من السلف</dt><dd>{formatEGP(account.totals.advance_in)}</dd></div><div><dt>سداد مستحقات</dt><dd>{formatEGP(account.totals.settlement_out)}</dd></div></dl>
        {Number(account.opening_adjustment || 0) !== 0 && <p className="employee-finance-opening"><CircleDollarSign /> رصيد افتتاحي قديم للعرض فقط: <strong>{formatEGP(account.opening_adjustment)}</strong> — لا يغيّر رصيد أي خزينة.</p>}
        <div className="employee-finance-month"><span>حركة {month}</span><strong>{account.selected_month.movement_count} معاملة · صافي {formatEGP(account.selected_month.signed_amount)}</strong></div>
        <div className="employee-finance-actions">{actionOptions.map(action => <button type="button" key={action.kind} onClick={() => setMovement({ account, kind: action.kind })}><action.icon />{action.label}</button>)}</div>
        <footer><button className="ledger-toggle" type="button" aria-expanded={isOpen} onClick={() => setExpanded(old => ({ ...old, [account.user.id]: !isOpen }))}>{isOpen ? <ChevronUp /> : <ChevronDown />} معاملات الشهر ({transactions.length})</button><a href={`/erp/finance?employee_user_id=${account.user.id}`}><ExternalLink /> عرض في الحسابات</a></footer>
        {isOpen && <div className="employee-finance-ledger">{transactions.length === 0 ? <p>لا توجد معاملات لهذا الموظف في الشهر المحدد. الرصيد بالأعلى هو رصيد كل الفترات.</p> : transactions.map(entry => <article key={entry.finance_id} id={`employee-finance-entry-${entry.finance_id}`}><div><strong>{kindLabels[entry.kind]}</strong><span>{entry.detail}</span><small>{entry.date} · {formatPaymentMethod(entry.method)} · قيد الحسابات #{entry.finance_id}</small></div><b className={Number(entry.signed_amount) >= 0 ? 'positive' : 'negative'}>{Number(entry.signed_amount) >= 0 ? '+' : '−'}{formatEGP(Math.abs(Number(entry.amount)))}</b><a href={`/erp/finance?employee_user_id=${account.user.id}&finance_entry_id=${entry.finance_id}`} aria-label={`عرض القيد رقم ${entry.finance_id} في الحسابات`}><ExternalLink /></a></article>)}</div>}
      </article>;
    })}</div>}
    {state.unlinked > 0 && <p className="employee-finance-unlinked">يوجد {state.unlinked} قيد قديم باسم أشرف أو مروة لم يُربط تلقائيًا لأن هوية الموظف غير مؤكدة. سيظل ظاهرًا في الحسابات دون إضافته إلى الرصيد هنا.</p>}
    {movement && <MovementDialog account={movement.account} kind={movement.kind} onClose={() => setMovement(null)} onSaved={() => { setNotice('تم حفظ المعاملة وظهرت في الحضور والحسابات بالرقم نفسه.'); load(); }} />}
  </section>;
}
