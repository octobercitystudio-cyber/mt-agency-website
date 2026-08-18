import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Banknote, Check, CheckCircle2, CircleDollarSign, Copy, FileText, FileUp, Package, RefreshCw, X, XCircle } from 'lucide-react';
import { formatBookingDate, formatDateTime12, formatEGP } from '../lib/businessFormat';
import { buildClientFinanceSummary, piastresToMoney } from '../lib/clientFinanceSummary';
import useModalDialog from '../hooks/useModalDialog';
import './ClientFinanceView.css';

const numberLabel = value => Number(value || 0).toLocaleString('ar-EG-u-nu-latn');
const unitLabel = unit => unit === 'reel' ? 'ريل' : 'ساعة';
const packageTotal = pkg => Number(pkg.total_price || 0) + Number(pkg.overage_amount || 0);
const outstandingPackage = pkg => Math.max(0, packageTotal(pkg) - Number(pkg.paid_amount || 0));
const outstandingInvoice = invoice => Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0));
const preciseEGP = piastres => formatEGP(piastresToMoney(piastres), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TRANSFER_METHODS = {
  instapay: { label: 'إنستاباي', account: '01114466646' },
  vodafone_cash: { label: 'فودافون كاش', account: '01094084424' },
};
const TRANSACTION_STATUS = {
  approved: { label: 'مقبولة', className: 'accepted' },
  pending: { label: 'في انتظار المراجعة', className: 'pending' },
  rejected: { label: 'مرفوضة', className: 'rejected' },
};
const normalizedTransactionStatus = status => status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
const transferMethodLabel = method => TRANSFER_METHODS[method]?.label || method || 'تحويل بنكي';

function PackageFinancialStatus({ pkg, dueNow, remaining }) {
  if (remaining <= 0) return <span className="client-finance-chip paid">مدفوعة بالكامل</span>;
  if (dueNow) return <span className="client-finance-chip due">مطلوب السداد الآن</span>;
  if (Number(pkg.paid_amount || 0) > 0) return <span className="client-finance-chip partial">سداد جزئي</span>;
  return <span className="client-finance-chip not-due">لم يحن موعد السداد</span>;
}

function InvoiceStatus({ invoice, remaining }) {
  if (remaining <= 0 || invoice.status === 'paid') return <span className="client-finance-chip paid">مدفوعة</span>;
  if (invoice.status === 'overdue') return <span className="client-finance-chip due">متأخرة</span>;
  return <span className="client-finance-chip partial">صادرة</span>;
}

function ProofFilePreview({ file }) {
  const previewUrl = useMemo(() => file && String(file.type || '').startsWith('image/') ? URL.createObjectURL(file) : '', [file]);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!file) return null;
  return <div className="client-proof-preview" aria-live="polite">
    {previewUrl ? <img src={previewUrl} alt="معاينة إثبات التحويل المحدد" /> : <FileText aria-hidden="true" />}
    <div><strong>{file.name}</strong><small>{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'ملف محدد للرفع'}</small></div>
  </div>;
}

const obligationKindLabel = row => row.displayKind === 'package' ? 'باقة تصوير' : row.displayKind === 'service' ? 'خدمة' : row.kind === 'package-overage' ? 'استهلاك إضافي' : 'فاتورة';

function FinanceObligationCard({ row }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const paidLength = row.totalPiastres > 0 ? circumference * (row.paidPiastres / row.totalPiastres) : 0;
  const remainingLength = circumference - paidLength;
  const roundedPercent = numberLabel(row.paidPercent);

  return <article className={`client-finance-obligation-card${row.dueNow ? ' is-due' : ''}`}>
    <header><div><span>{obligationKindLabel(row)}</span><h4>{row.label}</h4></div>{row.dueNow && <em><AlertTriangle/>مطلوب السداد</em>}</header>
    <div className="client-finance-obligation-body">
      <div className="client-finance-ring" aria-hidden="true">
        <svg viewBox="0 0 180 180" focusable="false">
          <circle className="ring-base" cx="90" cy="90" r={radius}/>
          <circle className="ring-remaining" cx="90" cy="90" r={radius} strokeDasharray={`${remainingLength} ${circumference}`} strokeDashoffset={-paidLength}/>
          <circle className="ring-paid" cx="90" cy="90" r={radius} strokeDasharray={`${paidLength} ${circumference}`}/>
        </svg>
        <div><span>تم سداده</span><strong>{roundedPercent}%</strong><small>{preciseEGP(row.remainingPiastres)} متبقي</small></div>
      </div>
      <dl className="client-finance-ring-values">
        <div className="total"><dt><i/>الإجمالي</dt><dd>{preciseEGP(row.totalPiastres)}</dd></div>
        <div className="paid"><dt><i/>المدفوع المعتمد</dt><dd>{preciseEGP(row.paidPiastres)}</dd></div>
        <div className="remaining"><dt><i/>المتبقي</dt><dd>{preciseEGP(row.remainingPiastres)}</dd></div>
      </dl>
    </div>
    <p className="client-sr-only">{row.label}: الإجمالي {preciseEGP(row.totalPiastres)}، المدفوع المعتمد {preciseEGP(row.paidPiastres)} بنسبة {roundedPercent} بالمائة، والمتبقي {preciseEGP(row.remainingPiastres)}.</p>
  </article>;
}

function FinanceOverview({ summary }) {
  return <section className="client-finance-overview" aria-labelledby="finance-overview-title">
    <header>
      <div><span>حساب مستقل لكل اشتراك</span><h3 id="finance-overview-title">المدفوع والمتبقي</h3><p>كل باقة أو خدمة لها رسم مستقل، وتُحتسب المدفوعات المعتمدة فقط.</p></div><strong>{numberLabel(summary.rows.length)}</strong>
    </header>
    <div className="client-finance-obligation-grid">{summary.rows.map(row => <FinanceObligationCard key={row.key} row={row}/>)}{!summary.rows.length && <div className="client-finance-empty compact"><CircleDollarSign/><p>لا توجد باقات أو خدمات مالية مسجلة حاليًا.</p></div>}</div>
  </section>;
}

export default function ClientFinanceView({
  activePackages,
  financialPackages = activePackages,
  invoices,
  payments,
  proofs,
  projects = [],
  offers = [],
  proofForm,
  proofBusy,
  onProofFormChange,
  onSubmitProof,
  onSelectTarget,
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const payTriggerRef = useRef(null);
  const packageRows = useMemo(() => activePackages.map(pkg => {
    const remaining = outstandingPackage(pkg);
    const threshold = Math.max(0, Number(pkg.payment_due_quantity || 0));
    const consumed = Math.max(0, Number(pkg.consumed_quantity || 0));
    const dueNow = threshold > 0 && consumed >= threshold && remaining > 0;
    const total = packageTotal(pkg);
    const paidPercent = total > 0 ? Math.min(100, (Number(pkg.paid_amount || 0) / total) * 100) : 100;
    return { ...pkg, remaining, threshold, consumed, dueNow, paidPercent };
  }), [activePackages]);

  const invoiceRows = useMemo(() => invoices.map(invoice => ({ ...invoice, remaining: outstandingInvoice(invoice) })), [invoices]);
  const financialInvoices = useMemo(() => invoices.map(invoice => {
    const linkedPackage = financialPackages.find(pkg => Number(pkg.source_invoice_id) === Number(invoice.id));
    const linkedProject = projects.find(project => Number(project.invoice_id) === Number(invoice.id) || Number(invoice.project_id) === Number(project.id));
    const linkedOffer = offers.find(offer => Number(offer.id) === Number(invoice.offer_id));
    return { ...invoice, client_label: linkedPackage?.name || linkedProject?.name || linkedOffer?.title || null, client_kind: linkedPackage ? 'package' : linkedProject || linkedOffer ? 'service' : 'invoice' };
  }), [financialPackages, invoices, offers, projects]);
  const financialSummary = useMemo(() => buildClientFinanceSummary(financialPackages, financialInvoices), [financialInvoices, financialPackages]);
  const targetOptions = useMemo(() => [
    ...packageRows.filter(pkg => pkg.remaining > 0).map(pkg => ({ value: `package:${pkg.id}`, label: `باقة: ${pkg.name}`, outstanding: pkg.remaining })),
    ...invoiceRows.filter(invoice => invoice.remaining > 0 && !['cancelled', 'void'].includes(invoice.status)).map(invoice => ({ value: `invoice:${invoice.id}`, label: `فاتورة: ${invoice.invoice_number}`, outstanding: invoice.remaining })),
  ], [invoiceRows, packageRows]);

  const pendingAmount = useMemo(() => proofs.filter(proof => proof.status === 'pending').reduce((sum, proof) => sum + Number(proof.amount || 0), 0), [proofs]);
  const selectedTarget = targetOptions.find(target => target.value === proofForm.target);
  const transferMethod = TRANSFER_METHODS[proofForm.payment_method] || TRANSFER_METHODS.instapay;
  const chooseTarget = (type, id, amount) => { onSelectTarget(type, id, amount); setPayOpen(true); };

  const closePay = useCallback(() => setPayOpen(false), []);
  const payDialogRef = useModalDialog(payOpen, closePay, { returnFocusRef: payTriggerRef, isolateBackground: true });
  const submitPayment = async event => { const sent = await onSubmitProof(event); if (sent) closePay(); };
  const copyAccount = async () => { await navigator.clipboard.writeText(transferMethod.account); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };

  const targetName = proof => {
    if (proof.client_package_id) return packageRows.find(pkg => Number(pkg.id) === Number(proof.client_package_id))?.name || `باقة #${proof.client_package_id}`;
    if (proof.invoice_id) return invoiceRows.find(invoice => Number(invoice.id) === Number(proof.invoice_id))?.invoice_number || `فاتورة #${proof.invoice_id}`;
    return 'تحويل قديم غير مخصص';
  };

  const allocationName = payment => {
    const proof = proofs.find(item => Number(item.payment_id) === Number(payment.id) && item.status === 'approved');
    return proof ? targetName(proof) : 'دفعة عامة';
  };

  const linkedPaymentIds = new Set(proofs.filter(proof => proof.status === 'approved' && proof.payment_id).map(proof => Number(proof.payment_id)));
  const transactionRows = [
    ...proofs.filter(proof => !proof.voided_at && proof.entry_kind !== 'reversal').map(proof => {
      const payment = proof.payment_id ? payments.find(item => Number(item.id) === Number(proof.payment_id)) : null;
      const status = normalizedTransactionStatus(proof.status);
      return {
        key: `proof:${proof.id}`,
        status,
        amount: proof.amount,
        title: targetName(proof),
        method: transferMethodLabel(proof.payment_method || payment?.method),
        reference: payment?.reference || proof.reference || '',
        date: proof.reviewed_at || proof.created_at,
        note: status === 'rejected' ? proof.admin_note : '',
        retryType: status === 'rejected' ? (proof.client_package_id ? 'package' : proof.invoice_id ? 'invoice' : '') : '',
        retryId: proof.client_package_id || proof.invoice_id || null,
      };
    }),
    ...payments.filter(payment => !linkedPaymentIds.has(Number(payment.id)) && !payment.voided_at && payment.entry_kind !== 'reversal').map(payment => ({
      key: `payment:${payment.id}`,
      status: normalizedTransactionStatus(payment.status),
      amount: payment.amount,
      title: allocationName(payment),
      method: transferMethodLabel(payment.method),
      reference: payment.reference || '',
      date: payment.reviewed_at || payment.created_at,
      note: payment.admin_note || '',
      retryType: '',
      retryId: null,
    })),
  ].sort((first, second) => (Date.parse(second.date || '') || 0) - (Date.parse(first.date || '') || 0) || second.key.localeCompare(first.key));

  return <section className="client-view client-finance-view" aria-labelledby="client-finance-title">
    <header className="client-finance-header client-finance-header--action">
      <div><span>حسابك المالي بوضوح</span><h2 id="client-finance-title">المالية والفواتير</h2><p>يظهر التحويل في سجل المدفوعات المعتمدة فقط بعد مراجعة المالك واعتماده.</p></div>
      <button ref={payTriggerRef} type="button" className="client-pay-now" onClick={() => setPayOpen(true)} disabled={!targetOptions.length}><Banknote/> ادفع</button>
    </header>
    {pendingAmount > 0 && <div className="client-proof-pending-banner" role="status"><RefreshCw/> تحويلات قيد المراجعة بقيمة {formatEGP(pendingAmount)}</div>}

    <FinanceOverview summary={financialSummary} />

    <section className="client-finance-section client-transaction-history" aria-labelledby="transaction-history-title">
      <header><div><span>كل المعاملات في سجل واحد</span><h3 id="transaction-history-title">سجل الحالات المالية</h3><p>تظهر حالة كل تحويل بوضوح: مقبولة، مرفوضة، أو في انتظار المراجعة.</p></div><strong>{numberLabel(transactionRows.length)}</strong></header>
      <div className="client-transaction-ledger">
        {transactionRows.map(row => {
          const statusMeta = TRANSACTION_STATUS[row.status];
          return <article className={`is-${statusMeta.className}`} key={row.key}>
            <span className="client-transaction-icon" aria-hidden="true">{row.status === 'approved' ? <CheckCircle2/> : row.status === 'rejected' ? <XCircle/> : <RefreshCw/>}</span>
            <div className="client-transaction-main"><strong>{formatEGP(row.amount)}</strong><span>{row.title}</span><small>{row.method} · {formatDateTime12(row.date)}{row.reference ? ` · ${row.reference}` : ''}</small>{row.note && <p>ملاحظة المراجعة: {row.note}</p>}</div>
            <span className={`client-transaction-status ${statusMeta.className}`}>{statusMeta.label}</span>
            {row.retryType && <button type="button" onClick={() => chooseTarget(row.retryType, row.retryId, undefined)}>رفع تحويل جديد</button>}
          </article>;
        })}
        {!transactionRows.length && <div className="client-finance-empty compact"><Banknote/><p>لا توجد معاملات مالية مسجلة بعد.</p></div>}
      </div>
    </section>

    <section className="client-finance-section" aria-labelledby="package-finance-title">
      <header><div><span>الباقات الفعالة</span><h3 id="package-finance-title">الحالة المالية لكل باقة</h3><p>الرصيد المالي منفصل عن رصيد الساعات أو الريلز.</p></div></header>
      <div className="client-package-finance-grid">
        {packageRows.map(pkg => <article className={`client-package-finance-card ${pkg.dueNow ? 'is-due' : ''}`} key={pkg.id}>
          <header><div><small>{unitLabel(pkg.billing_unit)}</small><h4>{pkg.name}</h4></div><PackageFinancialStatus pkg={pkg} dueNow={pkg.dueNow} remaining={pkg.remaining} /></header>
          <div className="client-finance-progress" aria-label={`تم دفع ${numberLabel(pkg.paidPercent)} بالمائة`}><i style={{ width: `${pkg.paidPercent}%` }} /></div>
          <dl>
            <div><dt>سعر الباقة</dt><dd>{formatEGP(pkg.total_price)}</dd></div>
            {Number(pkg.overage_amount || 0) > 0 && <div><dt>استهلاك زائد</dt><dd className="due-value">{formatEGP(pkg.overage_amount)}</dd></div>}
            <div><dt>المدفوع المعتمد</dt><dd className="paid-value">{formatEGP(pkg.paid_amount)}</dd></div>
            <div><dt>المتبقي</dt><dd className={pkg.remaining > 0 ? 'due-value' : ''}>{formatEGP(pkg.remaining)}</dd></div>
            <div><dt>تم استهلاكه</dt><dd>{numberLabel(pkg.consumed)} {unitLabel(pkg.billing_unit)}</dd></div>
            {pkg.threshold > 0 && <div><dt>حد السداد</dt><dd>{numberLabel(pkg.threshold)} {unitLabel(pkg.billing_unit)}</dd></div>}
          </dl>
          {pkg.dueNow && <p className="client-payment-alert"><AlertTriangle />وصل استهلاكك إلى {numberLabel(pkg.consumed)} {unitLabel(pkg.billing_unit)}، وحد السداد المحدد للباقة {numberLabel(pkg.threshold)} {unitLabel(pkg.billing_unit)}.</p>}
          {pkg.remaining > 0 && <button type="button" onClick={() => chooseTarget('package', pkg.id, pkg.remaining)}><Banknote /> ادفع لهذه الباقة</button>}
        </article>)}
        {!packageRows.length && <div className="client-finance-empty"><Package /><strong>لا توجد باقات فعالة</strong><p>ستظهر الحالة المالية للباقة هنا عند إضافتها.</p></div>}
      </div>
    </section>

    <section className="client-finance-section" aria-labelledby="invoice-list-title">
      <header><div><span>المستندات المالية</span><h3 id="invoice-list-title">الفواتير</h3><p>التواريخ والقيم الخاصة بكل فاتورة.</p></div><strong>{numberLabel(invoiceRows.length)}</strong></header>
      <div className="client-finance-invoices">
        {invoiceRows.map(invoice => <article key={invoice.id}>
          <header><div><span>{invoice.invoice_number}</span><h4>{formatEGP(invoice.total)}</h4></div><InvoiceStatus invoice={invoice} remaining={invoice.remaining} /></header>
          <dl><div><dt>مدفوع</dt><dd>{formatEGP(invoice.paid_amount)}</dd></div><div><dt>متبقي</dt><dd className={invoice.remaining ? 'due-value' : ''}>{formatEGP(invoice.remaining)}</dd></div><div><dt>تاريخ الإصدار</dt><dd>{formatBookingDate(invoice.issued_at)}</dd></div><div><dt>تاريخ الاستحقاق</dt><dd>{invoice.due_at ? formatBookingDate(invoice.due_at) : 'غير محدد'}</dd></div></dl>
          {invoice.remaining > 0 && !['cancelled', 'void'].includes(invoice.status) && <button type="button" onClick={() => chooseTarget('invoice', invoice.id, invoice.remaining)}>ادفع هذه الفاتورة</button>}
        </article>)}
        {!invoiceRows.length && <div className="client-finance-empty"><FileText /><strong>لا توجد فواتير بعد</strong><p>تُنشأ الفاتورة بعد قبول عرض السعر.</p></div>}
      </div>
    </section>

    {payOpen && createPortal(<div className="client-payment-modal" onMouseDown={event => { if (event.target === event.currentTarget) closePay(); }}><section ref={payDialogRef} role="dialog" aria-modal="true" aria-labelledby="client-payment-title"><button data-dialog-initial type="button" className="client-payment-modal__close" onClick={closePay} aria-label="إغلاق الدفع"><X/></button><header><span>إرسال إثبات تحويل</span><h2 id="client-payment-title">ادفع من حسابك</h2><p>حدد المبلغ وطريقة التحويل ثم ارفع صورة العملية.</p></header><form onSubmit={submitPayment}>
      <label>الباقة أو الفاتورة<select required value={proofForm.target} onChange={event => onProofFormChange({ target: event.target.value, amount: String(targetOptions.find(item => item.value === event.target.value)?.outstanding || '') })}><option value="">اختر المطلوب سداده</option>{targetOptions.map(target => <option key={target.value} value={target.value}>{target.label} — متبقي {formatEGP(target.outstanding)}</option>)}</select></label>
      <div className="client-payment-amounts"><div><span>إجمالي المتبقي</span><strong>{selectedTarget ? formatEGP(selectedTarget.outstanding) : '—'}</strong></div><label>المبلغ الذي ستدفعه<input required type="number" min="0.01" step="0.01" max={selectedTarget?.outstanding || undefined} value={proofForm.amount} onChange={event => onProofFormChange({ amount: event.target.value })} placeholder="0.00"/></label></div>
      <fieldset><legend>طريقة الدفع</legend><div className="client-transfer-methods">{Object.entries(TRANSFER_METHODS).map(([value, method]) => <label className={proofForm.payment_method === value ? 'active' : ''} key={value}><input type="radio" name="payment_method" value={value} checked={proofForm.payment_method === value} onChange={() => onProofFormChange({ payment_method: value })}/><span>{method.label}</span><strong>{method.account}</strong></label>)}</div></fieldset>
      <div className="client-transfer-account"><span>رقم التحويل عبر {transferMethod.label}</span><strong dir="ltr">{transferMethod.account}</strong><button type="button" onClick={copyAccount}>{copied ? <Check/> : <Copy/>}{copied ? 'تم النسخ' : 'نسخ الرقم'}</button></div>
      <label className="client-finance-file"><FileUp/><span>{proofForm.file?.name || 'حدد صورة التحويل أو ملف PDF'}</span><input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => onProofFormChange({ file: event.target.files?.[0] || null })}/></label><ProofFilePreview file={proofForm.file}/>
      <button className="client-primary" disabled={proofBusy || !selectedTarget}>{proofBusy ? <RefreshCw className="client-spin"/> : <FileUp/>}{proofBusy ? 'جارٍ الإرسال...' : 'إرسال إثبات الدفع'}</button>
    </form></section></div>, document.body)}
  </section>;
}
