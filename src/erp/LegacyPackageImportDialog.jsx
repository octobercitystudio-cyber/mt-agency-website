import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, FileCheck2, LockKeyhole, RefreshCw, Upload, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import { formatEGP, formatPackageQuantity } from '../lib/businessFormat';
import { legacyImportPayload, matchLegacyPackages } from '../lib/legacyPackageMatching';
import { parseLegacySqlitePackageFile } from '../lib/legacySqliteDatabase';
import { safeUiError } from '../lib/uiError';

const STATUS_LABELS = { active: 'نشطة', expired: 'منتهية', completed: 'مكتملة' };

export default function LegacyPackageImportDialog({ open, clients, services, onClose, onImported }) {
  const [manifest, setManifest] = useState(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [serviceOverrides, setServiceOverrides] = useState({});
  const [error, setError] = useState('');
  const matched = useMemo(() => manifest ? matchLegacyPackages({ packages: manifest.packages, clients, services, serviceOverrides }) : null, [manifest, clients, services, serviceOverrides]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const selectFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true); setError(''); setManifest(null); setConfirmed(false); setServiceOverrides({}); setFileName(file.name);
    try {
      setManifest(await parseLegacySqlitePackageFile(file));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'تعذر قراءة ملف البرنامج القديم.');
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (!manifest || !matched || matched.blocked || !confirmed || submitting) return;
    setSubmitting(true); setError('');
    const payload = {
      confirmation: 'IMPORT_PACKAGES_ONLY',
      idempotency_key: `legacydb.${manifest.source.sha256}`,
      source: manifest.source,
      packages: matched.rows.map(row => legacyImportPayload(row, manifest.source)),
    };
    const { data, error: requestError } = await dataClient.request('/client-packages/legacy-db-import', { method: 'POST', body: JSON.stringify(payload) });
    setSubmitting(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر نقل الباقات. لم يتم اعتماد العملية.'));
    onImported(data);
  };

  return <div className="packages-modal legacy-package-import-modal" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <section className="legacy-package-import" role="dialog" aria-modal="true" aria-labelledby="legacy-import-title" aria-describedby="legacy-import-description">
      <header>
        <div><span><Database/> نقل آمن من البرنامج القديم</span><h2 id="legacy-import-title">استيراد الباقات المباعة فقط</h2><p id="legacy-import-description">تُقرأ النسخة على جهازك، ثم تُطابق الباقات مع عملاء البرنامج الجديد برقم الموبايل فقط.</p></div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="إغلاق"><X/></button>
      </header>

      <div className="legacy-import-guard"><LockKeyhole/><p><strong>لن ننقل العملاء أو الحجوزات أو الخزنة أو المستخدمين.</strong> أسماء العملاء الحالية تظل كما هي، والمدفوع القديم يصبح رصيدًا افتتاحيًا للباقة ولا يُضاف كإيراد جديد.</p></div>
      <label className={`legacy-import-file${reading ? ' is-reading' : ''}`}>
        {reading ? <RefreshCw className="packages-spin"/> : manifest ? <FileCheck2/> : <Upload/>}
        <span><strong>{reading ? 'جارٍ فحص النسخة القديمة…' : manifest ? fileName : 'اختر ملف النسخة القديمة'}</strong><small>ملف DB أو SQLite — لا يتم رفع الملف كاملًا إلى الموقع</small></span>
        <input type="file" accept=".db,.sqlite,.sqlite3,application/x-sqlite3" onChange={selectFile} disabled={reading || submitting}/>
      </label>

      {error && <div className="legacy-import-error" role="alert"><AlertTriangle/><span>{error}</span></div>}

      {manifest && matched && <>
        <section className="legacy-import-summary" aria-label="ملخص ملف الباقات"><article><span>الباقات الموجودة</span><strong>{manifest.summary.packages}</strong></article><article><span>العملاء بأرقام مطابقة</span><strong>{matched.matchedClients}</strong></article><article><span>جاهزة للنقل</span><strong>{matched.importable}</strong></article><article className={matched.blocked ? 'blocked' : 'ready'}><span>تحتاج مراجعة</span><strong>{matched.blocked}</strong></article></section>
        <div className="legacy-import-table-wrap"><table><thead><tr><th>عميل البرنامج الجديد</th><th>الباقة القديمة</th><th>الرصيد</th><th>المالية والصلاحية</th><th>المطابقة</th></tr></thead><tbody>{matched.rows.map(row => { const compatibleServices=services.filter(service => (service.billing_unit === 'reel' || (Number(service.total_reels) > 0 && Number(service.total_hours) <= 0) ? 'reel' : 'hour') === row.billing_unit); return <tr key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><td><strong>{row.target_client_name || 'غير مطابق'}</strong><span>{row.source_phone}</span><small>الاسم القديم: {row.source_client_name}</small></td><td><strong>{row.source_service_name}</strong>{row.target_service_name ? <span>{row.target_service_name}</span> : <label className="legacy-service-map">اختر قالب الخدمة<select value={serviceOverrides[row.legacy_reference] || ''} onChange={event => { setConfirmed(false); setServiceOverrides(current => ({ ...current, [row.legacy_reference]: event.target.value })); }}><option value="">اختر القالب الصحيح</option>{compatibleServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>}<small>{STATUS_LABELS[row.status] || row.status}</small></td><td><strong>{formatPackageQuantity(row.purchased_quantity, row.billing_unit)}</strong><span>مستخدم {formatPackageQuantity(row.consumed_quantity, row.billing_unit)}</span><small>متبقي {formatPackageQuantity(row.remaining_quantity, row.billing_unit)}</small></td><td><strong>{formatEGP(row.total_price)}</strong><span>مدفوع {formatEGP(row.paid_amount)}</span><small>{row.starts_at} — {row.expires_at}</small></td><td>{row.importable ? <span className="legacy-match-ok"><CheckCircle2/> مطابق</span> : <ul>{row.match_problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}{row.source_warnings.length > 0 && <details><summary>ملاحظة من السجل القديم</summary>{row.source_warnings.map(warning => <p key={warning}>{warning}</p>)}</details>}</td></tr>; })}</tbody></table></div>

        {matched.blocked > 0 ? <div className="legacy-import-error"><AlertTriangle/><span>لن يبدأ النقل قبل مطابقة كل الباقات بأرقام الموبايل وقوالب الخدمات، حتى لا تُسجل باقة على عميل خطأ.</span></div> : <label className="legacy-import-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span><strong>راجعت المطابقة وأوافق على إضافة {matched.importable} باقة فقط.</strong><small>العملية لا تعدّل أي عميل ولا تسجل إيرادًا أو حجزًا قديمًا.</small></span></label>}
      </>}

      <footer><button type="button" onClick={onClose} disabled={submitting}>إلغاء</button><button type="button" className="primary" onClick={submit} disabled={!manifest || !matched || matched.blocked > 0 || !confirmed || submitting}>{submitting ? <><RefreshCw className="packages-spin"/> جارٍ نقل الباقات…</> : <><Database/> اعتماد ونقل الباقات</>}</button></footer>
    </section>
  </div>;
}
