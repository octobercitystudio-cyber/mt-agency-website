import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Database, FileCheck2, FolderKanban, Landmark, LockKeyhole, RefreshCw, Upload, UsersRound, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import { formatEGP, formatPackageQuantity } from '../lib/businessFormat';
import { legacyBusinessImportPayload, matchLegacyBusinessData } from '../lib/legacyPackageMatching';
import { parseLegacySqliteBusinessFile } from '../lib/legacySqliteDatabase';
import { safeUiError } from '../lib/uiError';

const STATUS_LABELS = { active: 'نشطة', expired: 'منتهية', completed: 'مكتملة' };
const financeKindLabel = kind => ({ income: 'إيراد', expense: 'مصروف', transfer_in: 'تحويل وارد', transfer_out: 'تحويل صادر', advance_in: 'سداد سلفة', advance_out: 'سحب سلفة', settlement_out: 'سداد مستحقات' }[kind] || kind);

export default function LegacyPackageImportDialog({ open, clients, services, resources = [], onClose, onImported }) {
  const [manifest, setManifest] = useState(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [serviceOverrides, setServiceOverrides] = useState({});
  const [resourceId, setResourceId] = useState('');
  const [error, setError] = useState('');
  const matched = useMemo(() => manifest ? matchLegacyBusinessData({ manifest, clients, services, resources, serviceOverrides, resourceId }) : null, [manifest, clients, services, resources, serviceOverrides, resourceId]);

  useEffect(() => {
    if (!open) return undefined;
    const resourceTimer = !resourceId ? window.setTimeout(() => setResourceId(String(resources.find(resource => Number(resource.is_active ?? 1) === 1)?.id || '')), 0) : null;
    const onKeyDown = event => { if (event.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { if (resourceTimer) window.clearTimeout(resourceTimer); document.removeEventListener('keydown', onKeyDown); };
  }, [open, submitting, onClose, resourceId, resources]);

  if (!open) return null;

  const selectFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true); setError(''); setManifest(null); setConfirmed(false); setServiceOverrides({}); setFileName(file.name);
    try { setManifest(await parseLegacySqliteBusinessFile(file)); }
    catch (readError) { setError(readError instanceof Error ? readError.message : 'تعذر قراءة ملف البرنامج القديم.'); }
    finally { setReading(false); }
  };

  const submit = async () => {
    if (!manifest || !matched || matched.blocked || !confirmed || submitting) return;
    setSubmitting(true); setError('');
    const payload = legacyBusinessImportPayload({ matched, source: manifest.source, sourceArchive: manifest.source_archive });
    const { data, error: requestError } = await dataClient.request('/legacy-data/import', { method: 'POST', body: JSON.stringify(payload) });
    setSubmitting(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر نقل بيانات البرنامج القديم. لم تُحفظ أي بيانات من العملية.'));
    onImported(data);
  };

  return <div className="packages-modal legacy-package-import-modal" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <section className="legacy-package-import legacy-business-import" role="dialog" aria-modal="true" aria-labelledby="legacy-import-title" aria-describedby="legacy-import-description">
      <header>
        <div><span><Database/> نقل آمن من البرنامج القديم</span><h2 id="legacy-import-title">نقل البيانات التشغيلية والمالية</h2><p id="legacy-import-description">تُقرأ النسخة على جهازك، وتُطابق كل بيانات العميل بالبرنامج الجديد برقم الموبايل فقط قبل الحفظ.</p></div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="إغلاق"><X/></button>
      </header>

      <div className="legacy-import-guard"><LockKeyhole/><p><strong>لن تُنقل حسابات الدخول أو كلمات المرور أو إعدادات النسخ الاحتياطي.</strong> أسماء العملاء الحالية لن تتغير. تُنقل الباقات والمواعيد والخدمات والمحاسبة والتذكيرات والنقاط داخل عملية واحدة؛ إذا فشل سجل واحد تُلغى العملية كلها.</p></div>
      <label className={`legacy-import-file${reading ? ' is-reading' : ''}`}>
        {reading ? <RefreshCw className="packages-spin"/> : manifest ? <FileCheck2/> : <Upload/>}
        <span><strong>{reading ? 'جارٍ فحص النسخة القديمة…' : manifest ? fileName : 'اختر ملف النسخة القديمة'}</strong><small>ملف DB أو SQLite — تُرسل بعد موافقتك البيانات التشغيلية المسموح بها فقط، ولا تُرسل جداول الدخول أو كلمات المرور</small></span>
        <input type="file" accept=".db,.sqlite,.sqlite3,application/x-sqlite3" onChange={selectFile} disabled={reading || submitting}/>
      </label>

      {error && <div className="legacy-import-error" role="alert"><AlertTriangle/><span>{error}</span></div>}

      {manifest && matched && <>
        <section className="legacy-import-summary legacy-business-summary" aria-label="ملخص البيانات القديمة">
          <article><Database/><span>الباقات</span><strong>{manifest.summary.packages}</strong></article>
          <article><FolderKanban/><span>الخدمات / المشروعات</span><strong>{manifest.summary.services} / {manifest.summary.projects}</strong></article>
          <article><CalendarDays/><span>المواعيد</span><strong>{manifest.summary.appointments}</strong></article>
          <article><Landmark/><span>الحركات المالية</span><strong>{manifest.summary.finance_entries}</strong></article>
          <article><UsersRound/><span>العملاء المطابقون</span><strong>{matched.matchedClients}</strong></article>
          <article className={matched.blocked ? 'blocked' : 'ready'}><AlertTriangle/><span>{matched.blocked ? 'تمنع النقل' : 'ملاحظات محفوظة'}</span><strong>{matched.blocked || manifest.warnings?.length || 0}</strong></article>
        </section>

        <label className="legacy-resource-map">الاستديو أو مورد المواعيد القديمة<select value={resourceId} onChange={event => { setConfirmed(false); setResourceId(event.target.value); }}><option value="">اختر مورد الحجوزات</option>{resources.filter(resource => Number(resource.is_active ?? 1) === 1).map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select><small>سيُستخدم للمواعيد فقط، ولا يغيّر بيانات الباقات أو الحسابات.</small></label>

        <details className="legacy-import-section" open><summary>الباقات المباعة ({matched.packages.length})</summary>
          <div className="legacy-import-table-wrap"><table><thead><tr><th>عميل البرنامج الجديد</th><th>الباقة القديمة</th><th>الرصيد</th><th>المالية والصلاحية</th><th>المطابقة</th></tr></thead><tbody>{matched.packages.map(row => { const compatibleServices=services.filter(service => (service.billing_unit === 'reel' || (Number(service.total_reels) > 0 && Number(service.total_hours) <= 0) ? 'reel' : 'hour') === row.billing_unit); return <tr key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><td><strong>{row.target_client_name || 'غير مطابق'}</strong><span>{row.source_phone}</span><small>الاسم القديم: {row.source_client_name}</small></td><td><strong>{row.source_service_name}</strong>{row.target_service_name ? <span>{row.target_service_name}</span> : <label className="legacy-service-map">اختر قالب الخدمة<select value={serviceOverrides[row.legacy_reference] || ''} onChange={event => { setConfirmed(false); setServiceOverrides(current => ({ ...current, [row.legacy_reference]: event.target.value })); }}><option value="">اختر القالب الصحيح</option>{compatibleServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>}<small>{STATUS_LABELS[row.status] || row.status}{row.inferred_service ? ' · مستنتجة من اسم الخدمة' : ''}</small></td><td><strong>{formatPackageQuantity(row.purchased_quantity, row.billing_unit)}</strong><span>مستخدم {formatPackageQuantity(row.consumed_quantity, row.billing_unit)}</span><small>متبقي {formatPackageQuantity(row.remaining_quantity, row.billing_unit)}</small></td><td><strong>{formatEGP(row.total_price)}</strong><span>مدفوع {formatEGP(row.paid_amount)}</span><small>{row.starts_at} — {row.expires_at}</small></td><td><MatchState row={row}/></td></tr>; })}</tbody></table></div>
        </details>

        <details className="legacy-import-section"><summary>المواعيد ({matched.appointments.length})</summary><div className="legacy-preview-list">{matched.appointments.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{row.target_client_name || row.source_client_name}</strong><span>{row.source_service_name}</span></div><div><strong>{row.date} · {row.start_time}–{row.end_time}</strong><span>{row.status === 'completed' ? `مكتمل · مصور ${formatPackageQuantity(row.actual_hours, 'hour')}` : 'موعد مؤكد'}</span></div><MatchState row={row}/></article>)}</div></details>
        <details className="legacy-import-section"><summary>الخدمات والمشروعات ({matched.projects.length})</summary><div className="legacy-preview-list">{matched.projects.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{row.target_client_name || row.source_client_name}</strong><span>{row.name}</span></div><div><strong>{formatEGP(row.agreed_price)}</strong><span>مدفوع {formatEGP(row.paid_amount)} · بداية {row.starts_at || 'غير محددة'}</span></div><MatchState row={row}/></article>)}</div></details>
        <details className="legacy-import-section"><summary>تعريفات الخدمات القديمة ({matched.service_catalog.length})</summary><div className="legacy-preview-list">{matched.service_catalog.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{row.name}</strong><span>{row.category} · {row.source_type || row.billing_unit}</span></div><div><strong>{formatEGP(row.price)}</strong><span>{row.billing_unit === 'hour' ? formatPackageQuantity(row.total_hours, 'hour') : row.billing_unit === 'reel' ? formatPackageQuantity(row.total_reels, 'reel') : 'خدمة بالمشروع'} · صلاحية {row.validity_days} يوم</span></div><MatchState row={row}/></article>)}</div></details>
        <details className="legacy-import-section"><summary>الخزنة والحسابات ({matched.finance_entries.length})</summary><div className="legacy-preview-list finance">{matched.finance_entries.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{financeKindLabel(row.entry_kind)} · {row.entity}</strong><span>{row.detail}</span></div><div><strong>{formatEGP(row.amount)}</strong><span>{row.date} · {row.source_method || row.method}</span></div><MatchState row={row}/></article>)}</div></details>
        <details className="legacy-import-section"><summary>أرصدة العملاء والنقاط ({matched.client_balances.length})</summary><div className="legacy-preview-list">{matched.client_balances.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{row.target_client_name || row.source_client_name}</strong><span>{row.source_phone}</span></div><div><strong>{row.points} نقطة</strong><span>مديونية {formatEGP(row.debt)} · رصيد {formatEGP(row.credit)}</span></div><MatchState row={row}/></article>)}</div></details>
        <details className="legacy-import-section"><summary>التذكيرات ({matched.reminders.length}) وإعدادات العمل ({matched.business_config.length})</summary><div className="legacy-preview-list">{matched.reminders.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{row.title}</strong><span>{row.type} · {row.status === 'completed' ? 'مكتمل' : 'قيد الانتظار'}</span></div><div><strong>{row.due_date}</strong><span>{row.is_recurring ? 'متكرر شهريًا' : 'مرة واحدة'}{Number(row.amount) > 0 ? ` · ${formatEGP(row.amount)}` : ''}</span></div><MatchState row={row}/></article>)}{matched.business_config.map(row => <article key={row.legacy_reference} className={row.importable ? '' : 'blocked'}><div><strong>{row.key}</strong><span>إعداد عمل محفوظ</span></div><div><strong>{row.value}</strong><span>لن يستبدل إعدادًا موجودًا في البرنامج الجديد</span></div><MatchState row={row}/></article>)}</div></details>

        {matched.blocked > 0 ? <div className="legacy-import-error"><AlertTriangle/><span>لن يبدأ النقل قبل حل كل المطابقات والملاحظات، حتى لا تُسجل حركة أو موعد أو باقة على عميل خطأ.</span></div> : <label className="legacy-import-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span><strong>راجعت المطابقة وأوافق على نقل كل السجلات الظاهرة أعلاه.</strong><small>ستُضاف إلى البيانات الحالية مرة واحدة دون حذف الموجود. الحركات القديمة لا تُنشئ إيرادًا إضافيًا من الباقات؛ دفتر الخزنة المنقول هو مصدر الحركة المالية.</small></span></label>}
      </>}

      <footer><button type="button" onClick={onClose} disabled={submitting}>إلغاء</button><button type="button" className="primary" onClick={submit} disabled={!manifest || !matched || matched.blocked > 0 || !confirmed || submitting}>{submitting ? <><RefreshCw className="packages-spin"/> جارٍ النقل والتحقق…</> : <><Database/> اعتماد ونقل البيانات</>}</button></footer>
    </section>
  </div>;
}

function MatchState({ row }) {
  if (!row.importable) return <ul>{(row.match_problems || []).map(problem => <li key={problem}>{problem}</li>)}</ul>;
  return <><span className="legacy-match-ok"><CheckCircle2/> مطابق</span>{row.source_warnings?.length ? <details><summary>ملاحظة محفوظة</summary>{row.source_warnings.map(warning => <p key={warning}>{warning}</p>)}</details> : null}</>;
}
