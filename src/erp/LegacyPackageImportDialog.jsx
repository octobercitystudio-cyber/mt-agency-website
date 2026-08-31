import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldCheck, Upload, X, XCircle } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { formatEGP, formatPackageQuantity } from '../lib/businessFormat';
import { parseLegacyPackageImportText, validateLegacyPackageImportRows } from '../lib/legacyPackageImport';
import { safeUiError } from '../lib/uiError';
import './LegacyPackageImportDialog.css';

const money = formatEGP;

export default function LegacyPackageImportDialog({ open, clients, services, returnFocusRef, onClose, onImported }) {
  const [sourceText, setSourceText] = useState('');
  const [sourceRows, setSourceRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const fileRef = useRef(null);
  const dialogRef = useModalDialog(open, onClose, { returnFocusRef });
  const validation = useMemo(() => validateLegacyPackageImportRows(sourceRows, clients, services), [sourceRows, clients, services]);

  if (!open) return null;

  const prepare = text => {
    const parsed = parseLegacyPackageImportText(text);
    if (!parsed.length) { setSourceRows([]); setError('لم نجد صفوف باقات. استخدم القالب ولا تحذف صف العناوين.'); return; }
    setSourceText(text); setSourceRows(parsed); setError(''); setConfirmed(false); setResults([]);
  };

  const readFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'tsv', 'txt'].includes(extension)) {
      setError('ارفع نسخة CSV UTF-8 من الملف. يمكنك أيضًا نسخ الصفوف من Excel ولصقها في المربع.');
      event.target.value = '';
      return;
    }
    setFileName(file.name);
    prepare(await file.text());
  };

  const changeMapping = (index, field, value) => {
    setSourceRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    setConfirmed(false);
  };

  const submit = async () => {
    if (busy || validation.summary.invalid || !confirmed) return;
    setBusy(true); setError(''); setResults([]);
    const nextResults = [];
    for (const row of validation.readyRows) {
      const { data, error: requestError } = await dataClient.request('/client-packages/legacy-import', {
        method: 'POST',
        body: JSON.stringify({
          legacy_reference: row.legacy_reference,
          client_id: Number(row.client_id),
          service_id: Number(row.service_id),
          package_name: row.package_name,
          billing_unit: row.billing_unit,
          purchased_quantity: String(row.purchased_quantity),
          consumed_quantity: String(row.consumed_quantity),
          total_price: Number(row.total_price).toFixed(2),
          paid_amount: Number(row.paid_amount).toFixed(2),
          starts_at: row.starts_at,
          expires_at: row.expires_at,
          payment_due_quantity: String(row.payment_due_quantity),
          status: row.status,
          notes: row.notes,
        }),
      });
      nextResults.push(requestError
        ? { reference: row.legacy_reference, name: row.package_name, ok: false, message: safeUiError(requestError, 'تعذر ترحيل هذه الباقة.') }
        : { reference: row.legacy_reference, name: row.package_name, ok: true, idempotent: Boolean(data?.idempotent), packageId: data?.id, message: data?.idempotent ? 'كانت مُرحّلة من قبل ولم تتكرر.' : 'تم ترحيلها بنجاح.' });
    }
    setResults(nextResults); setBusy(false);
    if (nextResults.some(item => item.ok && !item.idempotent)) await onImported?.(nextResults);
  };

  const successCount = results.filter(item => item.ok).length;
  return <div className="legacy-import-overlay" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="legacy-import-dialog" role="dialog" aria-modal="true" aria-labelledby="legacy-import-title">
      <header>
        <div><span><FileSpreadsheet/> نقل افتتاحي آمن</span><h2 id="legacy-import-title">استيراد الباقات من البرنامج القديم</h2><p>راجع المطابقة أولًا، ثم احفظ الباقات كأرصدة افتتاحية دون تسجيل المدفوع القديم كإيراد جديد.</p></div>
        <button type="button" aria-label="إغلاق" onClick={onClose} disabled={busy}><X/></button>
      </header>

      {!sourceRows.length && !results.length && <div className="legacy-import-start">
        <section className="legacy-import-policy"><ShieldCheck/><div><strong>ما الذي سينتقل؟</strong><p>إجمالي الرصيد، المستخدم والمتبقي، السعر، المدفوع والمتبقي المالي، الصلاحية والحالة. لن تُنشأ حركة خزنة عن المبالغ التي حُصلت قبل تشغيل النظام الجديد.</p></div></section>
        <div className="legacy-import-downloads">
          <a href="/templates/legacy-package-import.csv" download><Download/> تحميل قالب الاستيراد</a>
          <a href="/templates/legacy-package-import.xlsx" download><FileSpreadsheet/> نسخة Excel مع الشرح</a>
        </div>
        <label className="legacy-import-upload"><Upload/><span><strong>ارفع ملف CSV من Excel</strong><small>اختر CSV UTF-8، أو الصق الصفوف من Excel بالأسفل.</small></span><input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={readFile}/></label>
        {fileName && <small className="legacy-import-file-name">{fileName}</small>}
        <label className="legacy-import-paste"><span>أو الصق الجدول هنا</span><textarea value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="انسخ صف العناوين والصفوف من Excel والصقها هنا"/><button type="button" onClick={() => prepare(sourceText)}>مراجعة البيانات</button></label>
      </div>}

      {sourceRows.length > 0 && !results.length && <>
        <div className="legacy-import-summary" aria-label="ملخص الاستيراد">
          <div><span>كل الصفوف</span><strong>{validation.summary.total}</strong></div>
          <div className="is-ready"><span>جاهزة</span><strong>{validation.summary.ready}</strong></div>
          <div className={validation.summary.invalid ? 'is-error' : ''}><span>تحتاج مراجعة</span><strong>{validation.summary.invalid}</strong></div>
          <div><span>إجمالي الأسعار</span><strong>{money(validation.summary.total_price)}</strong></div>
          <div><span>مدفوع قديم</span><strong>{money(validation.summary.paid_amount)}</strong></div>
          <div><span>المتبقي للتحصيل</span><strong>{money(validation.summary.outstanding_amount)}</strong></div>
        </div>
        <div className="legacy-import-table-wrap"><table><thead><tr><th>الصف / المرجع</th><th>العميل</th><th>الخدمة والباقة</th><th>الرصيد</th><th>المالية</th><th>الصلاحية</th><th>المراجعة</th></tr></thead><tbody>{validation.rows.map((row, index) => <tr key={`${row.source_row}-${row.legacy_reference || index}`} className={row.errors.length ? 'has-errors' : ''}>
          <td><small>صف {row.source_row}</small><strong>{row.legacy_reference || 'بدون مرجع'}</strong></td>
          <td><select aria-label={`عميل الصف ${row.source_row}`} value={row.client_id} onChange={event => changeMapping(index, 'client_id', event.target.value)}><option value="">اختر العميل</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name} — {client.phone1}</option>)}</select><small>{row.client_name} {row.client_phone && `— ${row.client_phone}`}</small></td>
          <td><select aria-label={`خدمة الصف ${row.source_row}`} value={row.service_id} onChange={event => changeMapping(index, 'service_id', event.target.value)}><option value="">اختر الخدمة</option>{services.filter(service => !row.billing_unit || service.billing_unit === row.billing_unit).map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select><strong>{row.package_name}</strong></td>
          <td><span>{formatPackageQuantity(row.purchased_quantity, row.billing_unit)} إجمالي</span><span>{formatPackageQuantity(row.consumed_quantity, row.billing_unit)} مستخدم</span><strong>{formatPackageQuantity(row.remaining_quantity, row.billing_unit)} متبقي</strong></td>
          <td><span>{money(row.total_price)} إجمالي</span><span>{money(row.paid_amount)} مدفوع</span><strong>{money(row.outstanding_amount)} متبقي</strong></td>
          <td><span>{row.starts_at || '—'}</span><span>{row.expires_at || '—'}</span></td>
          <td>{row.errors.length ? <div className="legacy-import-row-errors"><XCircle/>{row.errors.map(message => <span key={message}>{message}</span>)}</div> : <div className="legacy-import-row-ready"><CheckCircle2/> جاهزة{row.warnings.map(message => <small key={message}><AlertTriangle/>{message}</small>)}</div>}</td>
        </tr>)}</tbody></table></div>
        <label className="legacy-import-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={validation.summary.invalid > 0 || busy}/><span><strong>راجعت الأرصدة والمبالغ والتواريخ</strong><small>أفهم أن المدفوع القديم سيُحفظ داخل رصيد الباقة فقط، ولن يدخل خزنة الشهر الحالي.</small></span></label>
        <footer><button type="button" className="secondary" onClick={() => { setSourceRows([]); setConfirmed(false); }} disabled={busy}>الرجوع للملف</button><button type="button" className="primary" onClick={submit} disabled={busy || validation.summary.invalid > 0 || !confirmed}>{busy ? 'جارٍ الترحيل…' : `ترحيل ${validation.summary.ready} باقة`}</button></footer>
      </>}

      {results.length > 0 && <div className="legacy-import-results">
        <div className={successCount === results.length ? 'result-hero success' : 'result-hero warning'}>{successCount === results.length ? <CheckCircle2/> : <AlertTriangle/>}<div><strong>تمت معالجة {results.length} باقة</strong><span>{successCount} ناجحة، {results.length - successCount} تحتاج إعادة المحاولة.</span></div></div>
        <ul>{results.map(item => <li key={item.reference} className={item.ok ? 'ok' : 'failed'}>{item.ok ? <CheckCircle2/> : <XCircle/>}<div><strong>{item.name} — {item.reference}</strong><span>{item.message}</span></div></li>)}</ul>
        <footer><button type="button" className="secondary" onClick={() => { setResults([]); setConfirmed(false); }}>مراجعة البيانات</button><button type="button" className="primary" onClick={onClose}>إغلاق</button></footer>
      </div>}
      {error && <div className="legacy-import-error" role="alert"><AlertTriangle/><span>{error}</span></div>}
    </section>
  </div>;
}
