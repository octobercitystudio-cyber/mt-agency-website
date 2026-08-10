import { useEffect, useMemo } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, CircleDollarSign, FileText, FileUp, Package, RefreshCw, XCircle } from 'lucide-react';
import { formatBookingDate, formatDateTime12, formatEGP } from '../lib/businessFormat';
import { buildClientFinanceSummary, piastresToMoney } from '../lib/clientFinanceSummary';
import './ClientFinanceView.css';

const numberLabel = value => Number(value || 0).toLocaleString('ar-EG-u-nu-latn');
const unitLabel = unit => unit === 'reel' ? 'ريل' : 'ساعة';
const packageTotal = pkg => Number(pkg.total_price || 0) + Number(pkg.overage_amount || 0);
const outstandingPackage = pkg => Math.max(0, packageTotal(pkg) - Number(pkg.paid_amount || 0));
const outstandingInvoice = invoice => Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0));
const preciseEGP = piastres => formatEGP(piastresToMoney(piastres), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function FinanceOverview({ summary }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const paidLength = summary.totalPiastres > 0 ? circumference * (summary.paidPiastres / summary.totalPiastres) : 0;
  const remainingLength = circumference - paidLength;
  const roundedPercent = numberLabel(summary.paidPercent);

  return <section className="client-finance-overview" aria-labelledby="finance-overview-title">
    <header>
      <div><span>نظرة مالية واضحة</span><h3 id="finance-overview-title">المدفوع والمتبقي</h3><p>تُحتسب المدفوعات المعتمدة فقط، ولا يدخل أي تحويل قيد المراجعة ضمن المدفوع.</p></div>
    </header>
    <div className="client-finance-overview-grid">
      <article className="client-finance-ring-card">
        <div className="client-finance-ring" aria-hidden="true">
          <svg viewBox="0 0 180 180" focusable="false">
            <circle className="ring-base" cx="90" cy="90" r={radius} />
            {summary.totalPiastres > 0 && <>
              <circle className="ring-remaining" cx="90" cy="90" r={radius} strokeDasharray={`${remainingLength} ${circumference}`} strokeDashoffset={-paidLength} />
              <circle className="ring-paid" cx="90" cy="90" r={radius} strokeDasharray={`${paidLength} ${circumference}`} />
            </>}
          </svg>
          <div><span>تم سداده</span><strong>{roundedPercent}%</strong><small>{preciseEGP(summary.remainingPiastres)} متبقي</small></div>
        </div>
        <dl className="client-finance-ring-values">
          <div className="total"><dt><i />الإجمالي</dt><dd>{preciseEGP(summary.totalPiastres)}</dd></div>
          <div className="paid"><dt><i />المدفوع المعتمد</dt><dd>{preciseEGP(summary.paidPiastres)}</dd></div>
          <div className="remaining"><dt><i />المتبقي</dt><dd>{preciseEGP(summary.remainingPiastres)}</dd></div>
        </dl>
        {summary.totalPiastres === 0 && <p className="client-finance-zero">لا توجد مبالغ مستحقة</p>}
        <p className="client-sr-only">إجمالي الالتزامات {preciseEGP(summary.totalPiastres)}، المدفوع المعتمد {preciseEGP(summary.paidPiastres)} بنسبة {roundedPercent} بالمائة، والمتبقي {preciseEGP(summary.remainingPiastres)}.</p>
      </article>

      <article className="client-finance-breakdown-card">
        <header><div><span>تفصيل الالتزامات</span><h4>كل باقة وفاتورة</h4></div><strong>{numberLabel(summary.rows.length)}</strong></header>
        <div className="client-finance-breakdown-list">
          {summary.rows.map(row => <article className={row.dueNow ? 'is-due' : ''} key={row.key}>
            <header><div><strong>{row.label}</strong><span>{row.kind === 'invoice' ? 'فاتورة' : row.kind === 'package-overage' ? 'استهلاك إضافي' : 'باقة'}</span></div>{row.dueNow && <em><AlertTriangle />مطلوب السداد</em>}</header>
            <div className="client-finance-stacked" role="img" aria-label={`${row.label}: مدفوع ${preciseEGP(row.paidPiastres)} بنسبة ${numberLabel(row.paidPercent)} بالمائة، متبقي ${preciseEGP(row.remainingPiastres)}`}>
              <i style={{ width: `${row.paidPercent}%` }} />
            </div>
            <dl><div><dt>الإجمالي</dt><dd>{preciseEGP(row.totalPiastres)}</dd></div><div><dt>المدفوع</dt><dd>{preciseEGP(row.paidPiastres)}</dd></div><div><dt>المتبقي</dt><dd>{preciseEGP(row.remainingPiastres)}</dd></div></dl>
          </article>)}
          {!summary.rows.length && <div className="client-finance-empty compact"><CircleDollarSign /><p>لا توجد مبالغ مستحقة حاليًا.</p></div>}
        </div>
      </article>
    </div>
  </section>;
}

export default function ClientFinanceView({
  activePackages,
  financialPackages = activePackages,
  invoices,
  payments,
  proofs,
  proofForm,
  proofBusy,
  onProofFormChange,
  onSubmitProof,
  onSelectTarget,
}) {
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
  const financialSummary = useMemo(() => buildClientFinanceSummary(financialPackages, invoices), [financialPackages, invoices]);
  const targetOptions = useMemo(() => [
    ...packageRows.filter(pkg => pkg.remaining > 0).map(pkg => ({ value: `package:${pkg.id}`, label: `باقة: ${pkg.name}`, outstanding: pkg.remaining })),
    ...invoiceRows.filter(invoice => invoice.remaining > 0 && !['cancelled', 'void'].includes(invoice.status)).map(invoice => ({ value: `invoice:${invoice.id}`, label: `فاتورة: ${invoice.invoice_number}`, outstanding: invoice.remaining })),
  ], [invoiceRows, packageRows]);

  const pendingProofs = useMemo(() => proofs.filter(proof => ['pending', 'rejected'].includes(proof.status)), [proofs]);
  const pendingAmount = useMemo(() => proofs.filter(proof => proof.status === 'pending').reduce((sum, proof) => sum + Number(proof.amount || 0), 0), [proofs]);
  const selectedTarget = targetOptions.find(target => target.value === proofForm.target);

  const targetName = proof => {
    if (proof.client_package_id) return packageRows.find(pkg => Number(pkg.id) === Number(proof.client_package_id))?.name || `باقة #${proof.client_package_id}`;
    if (proof.invoice_id) return invoiceRows.find(invoice => Number(invoice.id) === Number(proof.invoice_id))?.invoice_number || `فاتورة #${proof.invoice_id}`;
    return 'تحويل قديم غير مخصص';
  };

  const allocationName = payment => {
    const proof = proofs.find(item => Number(item.payment_id) === Number(payment.id) && item.status === 'approved');
    return proof ? targetName(proof) : 'دفعة عامة';
  };

  return <section className="client-view client-finance-view" aria-labelledby="client-finance-title">
    <header className="client-finance-header">
      <span>حسابك المالي بوضوح</span>
      <h2 id="client-finance-title">المالية والفواتير</h2>
      <p>يظهر التحويل في سجل المدفوعات المعتمدة فقط بعد مراجعة المالك واعتماده.</p>
    </header>

    <section className="client-finance-section client-transfer-section" id="client-transfer-proof" aria-labelledby="transfer-proof-title">
      <header><div><span>أول خطوة للسداد</span><h3 id="transfer-proof-title">رفع إثبات التحويل</h3><p>اختر الباقة أو الفاتورة، ثم ارفع صورة التحويل. يظل المبلغ قيد المراجعة ولا يُحتسب كمدفوع حتى يعتمده المالك.</p></div>{pendingAmount > 0 && <strong className="client-proof-pending-badge"><RefreshCw />قيد المراجعة: {formatEGP(pendingAmount)}</strong>}</header>
      <form onSubmit={onSubmitProof}>
        <label>سيتم السداد إلى
          <select required value={proofForm.target} onChange={event => onProofFormChange({ target: event.target.value, amount: String(targetOptions.find(item => item.value === event.target.value)?.outstanding || '') })}>
            <option value="">اختر باقة أو فاتورة</option>
            {targetOptions.map(target => <option key={target.value} value={target.value}>{target.label} — متبقي {formatEGP(target.outstanding)}</option>)}
          </select>
        </label>
        <label>مبلغ التحويل بالجنيه المصري
          <input required type="number" min="0.01" step="0.01" max={selectedTarget?.outstanding || undefined} value={proofForm.amount} onChange={event => onProofFormChange({ amount: event.target.value })} placeholder="أدخل المبلغ" />
          {selectedTarget && <small>الحد الأقصى: {formatEGP(selectedTarget.outstanding, { minimumFractionDigits: 2 })}</small>}
        </label>
        <label className="client-finance-file"><FileUp /><span>{proofForm.file?.name || 'اختر صورة أو PDF (حتى 5MB)'}</span><input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => onProofFormChange({ file: event.target.files?.[0] || null })} /></label>
        <button className="client-primary" disabled={proofBusy || !selectedTarget}>{proofBusy ? <RefreshCw className="client-spin" /> : <FileUp />}{proofBusy ? 'جارٍ الرفع...' : 'رفع التحويل للمراجعة'}</button>
      </form>
      <ProofFilePreview file={proofForm.file} />
    </section>

    <FinanceOverview summary={financialSummary} />

    <section className="client-finance-section client-proof-status-section" aria-labelledby="proof-history-title">
      <header><div><span>حالة إثباتات التحويل</span><h3 id="proof-history-title">التحويلات قيد المراجعة والمرفوضة</h3><p>التحويل المعلّق لا يظهر ضمن المدفوع قبل قرار المالك.</p></div></header>
      <div className="client-transfer-list">
        {pendingProofs.map(proof => <article className={proof.status} key={proof.id}>
          <span className={`client-finance-chip ${proof.status === 'pending' ? 'partial' : 'rejected'}`}>{proof.status === 'pending' ? 'قيد مراجعة المالك' : 'مرفوض'}</span>
          <div><strong>{formatEGP(proof.amount)}</strong><span>{targetName(proof)}</span><small>{formatDateTime12(proof.created_at)}</small>{proof.status === 'rejected' && proof.admin_note && <p><XCircle />ملاحظة المالك: {proof.admin_note}</p>}</div>
          {proof.status === 'rejected' && (proof.client_package_id || proof.invoice_id) && <button type="button" onClick={() => onSelectTarget(proof.client_package_id ? 'package' : 'invoice', proof.client_package_id || proof.invoice_id, undefined)}>رفع تحويل جديد</button>}
        </article>)}
        {!pendingProofs.length && <div className="client-finance-empty compact"><Banknote /><p>لا توجد تحويلات قيد المراجعة أو مرفوضة.</p></div>}
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
          {pkg.remaining > 0 && <button type="button" onClick={() => onSelectTarget('package', pkg.id, pkg.remaining)}><Banknote /> ادفع لهذه الباقة</button>}
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
          {invoice.remaining > 0 && !['cancelled', 'void'].includes(invoice.status) && <button type="button" onClick={() => onSelectTarget('invoice', invoice.id, invoice.remaining)}>ادفع هذه الفاتورة</button>}
        </article>)}
        {!invoiceRows.length && <div className="client-finance-empty"><FileText /><strong>لا توجد فواتير بعد</strong><p>تُنشأ الفاتورة بعد قبول عرض السعر.</p></div>}
      </div>
    </section>

    <section className="client-finance-section" aria-labelledby="payment-history-title">
      <header><div><span>بعد اعتماد المالك</span><h3 id="payment-history-title">سجل المدفوعات المعتمدة</h3><p>هذا السجل فقط هو الذي يدخل ضمن قيمة المدفوع في الملخص.</p></div></header>
      <div className="client-approved-list">
        {payments.filter(payment => payment.status === 'approved').map(payment => <article key={payment.id}><CheckCircle2 /><div><strong>{formatEGP(payment.amount)}</strong><span>{allocationName(payment)}</span><small>{payment.method || 'تحويل بنكي'} · {formatDateTime12(payment.reviewed_at || payment.created_at)}{payment.reference ? ` · ${payment.reference}` : ''}</small></div></article>)}
        {!payments.some(payment => payment.status === 'approved') && <div className="client-finance-empty compact"><CircleDollarSign /><p>لا توجد مدفوعات معتمدة بعد.</p></div>}
      </div>
    </section>
  </section>;
}
