import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, CheckCircle2, ChevronLeft, CircleDollarSign, FileText, History, Info, PackageOpen, Pencil, RefreshCw, Search, Send, ShieldCheck, Smartphone, Users, Wallet, X } from 'lucide-react';
import { formatDateTime12, formatPaymentMethod } from '../lib/businessFormat';
import { financeCategoryLabel, financeLedgerEntries, financeLedgerEntryPresentation } from '../lib/financeLedger';
import useModalDialog from '../hooks/useModalDialog';
import './FinanceClearLedger.css';

const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateLabel = value => {
  const day = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value || 'غير محدد';
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day}T12:00:00`));
};

export function FinanceAmount({ value, direction, className = '' }) {
  return <span className={`fc-money ${className}`}><bdi dir="ltr">{direction ? `${direction > 0 ? '+' : '−'} ` : ''}{amountFormat.format(Number(value || 0))}</bdi><small>ج.م</small></span>;
}

export function FinanceOverview({ income, expense, profit, month, receivables, onReceivables, onRetryReceivables }) {
  return <section className="fc-overview" aria-label="ملخص الحسابات">
    <article className="fc-metric income"><span className="fc-metric-label"><ArrowDownLeft aria-hidden="true"/> إيرادات الشهر</span><FinanceAmount value={income}/><small>إيرادات تشغيلية · <bdi>{month}</bdi></small></article>
    <article className="fc-metric expense"><span className="fc-metric-label"><ArrowUpRight aria-hidden="true"/> مصروفات الشهر</span><FinanceAmount value={expense}/><small>مصروفات تشغيلية · <bdi>{month}</bdi></small></article>
    <article className="fc-metric profit"><span className="fc-metric-label"><CircleDollarSign aria-hidden="true"/> أرباح الشهر</span><FinanceAmount value={profit}/><small>الإيرادات ناقص المصروفات · دون التحويلات</small></article>
    <article className="fc-metric receivables" aria-busy={receivables.loading}><button type="button" className="fc-receivables-open" onClick={onReceivables} aria-label="عرض تفاصيل فلوس الشركة عند العملاء"><span className="fc-metric-label"><Users aria-hidden="true"/> فلوس الشركة عند العملاء</span>{receivables.loading || receivables.error || !receivables.data ? <strong className="fc-metric-unavailable">—</strong> : <FinanceAmount value={receivables.data.amount}/>}<small>الباقات النشطة حاليًا · حتى اليوم</small><span className="fc-metric-link">{receivables.loading ? 'جارٍ تحديث المستحقات…' : 'تفصيل العملاء والباقات'}<ChevronLeft aria-hidden="true"/></span></button>{receivables.error && <div className="fc-receivables-error" role="alert"><span>تعذر تحميل المستحقات</span><button type="button" onClick={onRetryReceivables}><RefreshCw aria-hidden="true"/> إعادة المحاولة</button></div>}</article>
  </section>;
}

export function FinanceWallets({ balances, month, isAdmin, canAdjust, onAdjust }) {
  const wallets = [
    { key: 'cash', label: 'كاش', method: 'cash', icon: Banknote, note: 'الخزينة النقدية' },
    { key: 'instapay', label: 'انستاباي', method: 'instapay', icon: Send, note: 'يشمل رصيد التحويل البنكي' },
    { key: 'vodafone', label: 'فودافون كاش', method: 'vodafone_cash', icon: Smartphone, note: 'محفظة فودافون كاش' },
  ];
  return <section className="fc-wallets" aria-labelledby="finance-wallets-heading"><header><div><h2 id="finance-wallets-heading"><Wallet aria-hidden="true"/> المحافظ</h2><p>تبدأ من الصفر يوم 1 · <bdi>{month}</bdi></p></div><span>رصيد كل محفظة بعد حركات الشهر</span></header><div className="fc-wallet-grid">{wallets.map(({ key, label, method, icon: Icon, note }) => <article key={key} className={`fc-wallet fc-wallet--${key}`}><header><span className="fc-wallet-icon"><Icon aria-hidden="true"/></span><h3>{label}</h3>{isAdmin && <button type="button" className="finance-wallet-edit no-print" disabled={!canAdjust} aria-label={`تسوية رصيد ${label}`} title={canAdjust ? 'تسوية الرصيد' : 'التسوية متاحة في الشهر الحالي المفتوح فقط'} onClick={() => onAdjust(method, balances[key])}><Pencil aria-hidden="true"/></button>}</header><FinanceAmount value={balances[key]}/><p>{note}</p></article>)}</div></section>;
}

export default function FinanceClearLedger({ entries, month, employeeId, isOwner, onOwnerAction, targetEntryId }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [viewedEntryId, setViewedEntryId] = useState(null);
  const detailsTriggerRef = useRef(null);
  const filtered = useMemo(() => financeLedgerEntries(entries, { month, employeeId, query, kind }), [entries, month, employeeId, query, kind]);
  const monthly = useMemo(() => financeLedgerEntries(entries, { month, employeeId }), [entries, month, employeeId]);
  const viewedEntry = entries.find(entry => String(entry.id) === String(viewedEntryId));
  const closeDetails = useCallback(() => setViewedEntryId(null), []);
  const openDetails = (entry, event) => { detailsTriggerRef.current = event.currentTarget; setViewedEntryId(entry.id); };
  const tabs = [['all', 'كل الحركات'], ['income', 'الإيرادات'], ['expense', 'المصروفات'], ['transfer', 'التحويلات']];
  return <>
    <section className="fc-ledger" aria-labelledby="finance-unified-ledger-title">
      <header className="fc-ledger-heading"><div><h2 id="finance-unified-ledger-title">سجل الحركات المالية</h2><p>الإيرادات والمصروفات والتحويلات</p></div><span className="fc-ledger-count">{monthly.length.toLocaleString('ar-EG')} حركة في الشهر</span></header>
      <div className="fc-ledger-filters"><label className="fc-ledger-search"><Search aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="البحث في الحركات المالية" placeholder="اسم العميل أو البيان أو مرجع الحركة"/></label><nav className="fc-type-filters" aria-label="نوع الحركة">{tabs.map(([value, label]) => <button type="button" key={value} className={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}</nav></div>
      {filtered.length ? <>
        <div className="fc-table-wrap"><table className="fc-ledger-table"><caption className="visually-hidden">الحركات المالية المسجلة للشهر {month}</caption><thead><tr><th scope="col">التاريخ / النوع</th><th scope="col">العميل وتفاصيل الحركة</th><th scope="col">المحفظة / طريقة الدفع</th><th scope="col">حالة القيد</th><th scope="col">المبلغ</th><th scope="col">المراجعة</th></tr></thead><tbody>{filtered.map(entry => {
          const presentation = financeLedgerEntryPresentation(entry);
          return <tr key={entry.id} id={`finance-entry-${entry.id}`} className={`${presentation.kind} ${presentation.isReversal ? 'is-reversal' : ''} ${entry.voided_at ? 'is-voided' : ''} ${String(entry.id) === String(targetEntryId) ? 'is-highlighted' : ''}`}>
            <td><time dateTime={String(entry.date || '').slice(0, 10)}>{dateLabel(entry.date)}</time><EntryKind presentation={presentation}/><small className="fc-entry-reference">قيد <bdi>#{entry.id}</bdi></small></td>
            <td><EntryIdentity entry={entry} presentation={presentation}/></td>
            <td><EntryMethod entry={entry}/></td>
            <td><EntryState entry={entry} presentation={presentation}/></td>
            <td className="fc-amount-cell"><FinanceAmount value={entry.amount} direction={presentation.direction} className={presentation.kind}/></td>
            <td><EntryActions entry={entry} isOwner={isOwner} onOwnerAction={onOwnerAction} onDetails={openDetails}/></td>
          </tr>;
        })}</tbody></table></div>
        <div className="fc-ledger-cards">{filtered.map(entry => {
          const presentation = financeLedgerEntryPresentation(entry);
          return <article key={entry.id} id={`finance-entry-card-${entry.id}`} className={`fc-entry-card ${presentation.kind} ${presentation.isReversal ? 'is-reversal' : ''} ${entry.voided_at ? 'is-voided' : ''} ${String(entry.id) === String(targetEntryId) ? 'is-highlighted' : ''}`}><header><EntryKind presentation={presentation}/><time dateTime={String(entry.date || '').slice(0, 10)}>{dateLabel(entry.date)}</time></header><EntryIdentity entry={entry} presentation={presentation}/><div className="fc-card-amount"><span>المبلغ</span><FinanceAmount value={entry.amount} direction={presentation.direction} className={presentation.kind}/></div><dl><div><dt>المحفظة / الدفع</dt><dd><EntryMethod entry={entry}/></dd></div><div><dt>حالة القيد</dt><dd><EntryState entry={entry} presentation={presentation}/></dd></div><div><dt>المرجع</dt><dd><bdi>#{entry.id}</bdi></dd></div></dl><EntryActions entry={entry} isOwner={isOwner} onOwnerAction={onOwnerAction} onDetails={openDetails}/></article>;
        })}</div>
      </> : <div className="fc-empty" role="status"><Search aria-hidden="true"/><strong>{monthly.length ? 'لا توجد حركات مطابقة' : 'لا توجد حركات في هذا الشهر'}</strong><p>{monthly.length ? 'جرّب اسمًا آخر أو اختر كل الحركات.' : 'ستظهر هنا الحركات المالية المسجلة للشهر المختار.'}</p>{(query || kind !== 'all') && <button type="button" onClick={() => { setQuery(''); setKind('all'); }}>مسح البحث والفلاتر</button>}</div>}
      <footer className="fc-ledger-footer"><span>عرض {filtered.length.toLocaleString('ar-EG')} من {monthly.length.toLocaleString('ar-EG')} حركة</span><span><Info aria-hidden="true"/> التحويلات الداخلية لا تدخل في الإيرادات أو الأرباح.</span></footer>
    </section>
    <FinanceEntryDetails open={viewedEntryId !== null} entry={viewedEntry} onClose={closeDetails} returnFocusRef={detailsTriggerRef}/>
  </>;
}

function EntryKind({ presentation }) {
  const Icon = presentation.kind === 'transfer' ? ArrowLeftRight : presentation.kind === 'other' ? FileText : presentation.direction > 0 ? ArrowDownLeft : ArrowUpRight;
  return <span className={`fc-entry-kind ${presentation.kind}`}><Icon aria-hidden="true"/>{presentation.label}</span>;
}

function EntryIdentity({ entry, presentation }) {
  const income = presentation.kind === 'income';
  const title = income ? entry.client_name || entry.employee_name || 'إيراد عام' : entry.detail || (presentation.kind === 'transfer' ? 'تحويل بين محافظ الشركة' : presentation.kind === 'other' ? 'حركة مالية' : 'مصروف الشركة');
  return <div className="fc-entry-identity"><strong>{title}</strong>{income && entry.detail && <p>{entry.detail}</p>}{entry.source_label && <span className="fc-source-label" title={(entry.source_labels || []).join(' · ')}><PackageOpen aria-hidden="true"/>{entry.source_label}{Number(entry.source_extra_count) > 0 && <b>+{entry.source_extra_count} أخرى</b>}</span>}<small>{entry.employee_name ? `حساب الموظف: ${entry.employee_name} · ` : !income && entry.entity ? `${entry.entity} · ` : ''}{financeCategoryLabel(entry)}</small></div>;
}

function EntryMethod({ entry }) {
  return <div className="fc-entry-method"><span>{formatPaymentMethod(entry.method)}</span>{entry.employee_user_id && entry.entity !== 'الشركة' && <small>على حساب {entry.employee_name || entry.entity || 'الموظف'}</small>}</div>;
}

function EntryState({ entry, presentation }) {
  if (presentation.isReversal) return <span className="fc-entry-state reversal"><ShieldCheck aria-hidden="true"/> قيد عكسي موثق</span>;
  if (entry.voided_at) return <span className="fc-entry-state voided"><ShieldCheck aria-hidden="true"/> ملغى وموثق</span>;
  if (presentation.kind === 'transfer') return <span className="fc-entry-state transfer"><ArrowLeftRight aria-hidden="true"/> طرف تحويل داخلي</span>;
  if (entry.is_system) return <span className="fc-entry-state system"><ShieldCheck aria-hidden="true"/> قيد نظامي</span>;
  if (entry.source_type) return <span className="fc-entry-state linked"><CheckCircle2 aria-hidden="true"/> مرتبط بالمصدر</span>;
  return <span className="fc-entry-state manual">قيد يدوي</span>;
}

function EntryActions({ entry, isOwner, onOwnerAction, onDetails }) {
  const locked = entry.entry_kind === 'reversal' || entry.voided_at;
  const transfer = ['transfer_in', 'transfer_out'].includes(entry.entry_kind);
  return <div className="fc-entry-actions no-print"><button type="button" className="fc-entry-history" onClick={event => onDetails(entry, event)} aria-label={`تفاصيل وسجل الحركة ${entry.id}`}><History aria-hidden="true"/> السجل</button>{isOwner && <div className="finance-owner-actions" aria-label="إجراءات المالك"><button type="button" disabled={locked || transfer} onClick={event => onOwnerAction(entry, 'correct', event)}>تعديل</button><button type="button" className="void" disabled={locked} onClick={event => onOwnerAction(entry, 'void', event)}>{transfer ? 'إلغاء الطرفين' : 'إلغاء'}</button>{locked && <small>محفوظ كسجل ملغى</small>}</div>}</div>;
}

function FinanceEntryDetails({ open, entry, onClose, returnFocusRef }) {
  const dialogRef = useModalDialog(open, onClose, { returnFocusRef, isolateBackground: true });
  if (!open) return null;
  const presentation = entry ? financeLedgerEntryPresentation(entry) : null;
  return <div className="erp-modal-overlay fc-record-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className={`fc-record-dialog ${presentation?.kind || ''}`} role="dialog" aria-modal="true" aria-labelledby="finance-entry-details-title" tabIndex={-1}><header><div><span>بيانات القيد وسجل حالته</span><h2 id="finance-entry-details-title">تفاصيل الحركة {entry && <bdi>#{entry.id}</bdi>}</h2></div><button type="button" data-dialog-initial onClick={onClose} aria-label="إغلاق تفاصيل الحركة"><X aria-hidden="true"/></button></header>{entry ? <div className="fc-record-body"><div className="fc-record-amount"><EntryKind presentation={presentation}/><FinanceAmount value={entry.amount} direction={presentation.direction} className={presentation.kind}/></div><EntryIdentity entry={entry} presentation={presentation}/><dl className="fc-record-fields"><div><dt>تاريخ الحركة</dt><dd>{dateLabel(entry.date)}</dd></div><div><dt>طريقة الدفع</dt><dd><EntryMethod entry={entry}/></dd></div><div><dt>التصنيف</dt><dd>{financeCategoryLabel(entry)}</dd></div><div><dt>حالة القيد</dt><dd><EntryState entry={entry} presentation={presentation}/></dd></div>{entry.client_name && <div><dt>العميل</dt><dd>{entry.client_name}</dd></div>}{entry.employee_name && <div><dt>حساب الموظف</dt><dd>{entry.employee_name}</dd></div>}{entry.source_label && <div className="fc-full"><dt>الباقات / الخدمات المرتبطة</dt><dd>{(entry.source_labels?.length ? entry.source_labels : [entry.source_label]).join(' · ')}</dd></div>}{entry.invoice_numbers?.length > 0 && <div className="fc-full"><dt>الفواتير المرتبطة</dt><dd>{entry.invoice_numbers.join(' · ')}</dd></div>}{entry.payment_references?.length > 0 && <div className="fc-full"><dt>مراجع الدفعات</dt><dd>{entry.payment_references.join(' · ')}</dd></div>}{entry.correlation_id && <div className="fc-full"><dt>مرجع الربط</dt><dd><bdi>{entry.correlation_id}</bdi></dd></div>}</dl><section className="fc-record-audit"><h3><FileText aria-hidden="true"/> سجل العملية</h3><p>قيد رقم <bdi>#{entry.id}</bdi> · {presentation.label}</p>{entry.created_at && <p>تاريخ التسجيل: <bdi>{formatDateTime12(entry.created_at)}</bdi></p>}{entry.voided_at && <p>تم إلغاء الأثر المالي بتاريخ <bdi>{formatDateTime12(entry.voided_at)}</bdi> مع الاحتفاظ بالقيد.</p>}{entry.void_reason && <p>سبب الإلغاء: {entry.void_reason}</p>}{presentation.isReversal && <p>قيد عكسي محفوظ لتوثيق تصحيح أو إلغاء أثر الحركة الأصلية.</p>}{presentation.kind === 'transfer' && <p>هذا القيد أحد طرفي تحويل بين المحافظ، ولا يدخل ضمن أرباح الشركة.</p>}</section></div> : <div className="fc-empty"><AlertCircle/><strong>الحركة غير متاحة الآن</strong><p>أغلق النافذة وحدّث الحسابات ثم أعد المحاولة.</p></div>}<footer><button type="button" onClick={onClose}>إغلاق التفاصيل</button></footer></section></div>;
}
