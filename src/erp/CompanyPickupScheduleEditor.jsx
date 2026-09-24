import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import CompanyPickupSchedule from '../components/CompanyPickupSchedule';
import { PICKUP_DAY_ORDER, PICKUP_WEEKDAYS } from '../lib/pickupWeekdays';
import { emptyCompanyPickupSchedule, validateCompanyPickupSchedule } from '../lib/pickupSchedule';
import './CompanyPickupScheduleEditor.css';

const emptySchedule = emptyCompanyPickupSchedule;
const normalizeSchedule = data => ({ ...emptySchedule(), ...data, enabled: data?.enabled === true || Number(data?.enabled) === 1, windows: Array.isArray(data?.windows) ? data.windows.map(window => ({ weekday: Number(window.weekday), start_time: window.start_time, end_time: window.end_time })) : [] });

export default function CompanyPickupScheduleEditor({ syncEnabled = true }) {
  const [draft, setDraft] = useState(emptySchedule);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [latestSaved, setLatestSaved] = useState(null);
  const requestRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const rowIdRef = useRef(0);
  const withRowIds = value => ({ ...value, windows: value.windows.map(window => ({ ...window, rowId: ++rowIdRef.current })) });

  const load = useCallback(async (background = false) => {
    if (savingRef.current || loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const requestId = ++requestRef.current;
    if (!background) { setLoading(true); setError(''); setNotice(''); }
    try {
      const { data, error: requestError } = await dataClient.request('/post-production/pickup-schedule', { method: 'GET' });
      if (requestId !== requestRef.current) return;
      if (requestError) { if (!background) setError(requestError.message || 'تعذر تحميل جدول الاستلام. أعد المحاولة قبل الحفظ.'); return; }
      if (!data || !Number.isInteger(Number(data.revision)) || !Array.isArray(data.windows)) { if (!background) setError('تعذر قراءة جدول الاستلام. أعد المحاولة قبل الحفظ.'); return; }
      const next = normalizeSchedule(data);
      if (background && dirtyRef.current) { if (Number(next.revision) !== revisionRef.current) setConflict(true); return; }
      revisionRef.current = Number(next.revision);
      if (dirtyRef.current) {
        setDraft(current => ({ ...current, revision: next.revision }));
        setLatestSaved(next);
        setNotice('تم تحميل رقم أحدث نسخة، مع الاحتفاظ بتعديلاتك. راجع المعاينة ثم احفظ لتطبيقها على جميع العملاء.');
      } else setDraft(withRowIds(next));
      setLoaded(true); setConflict(false);
    } catch { if (requestId === requestRef.current && !background) setError('تعذر الاتصال. أعد المحاولة لتحميل الجدول قبل الحفظ.'); }
    finally { if (requestId === requestRef.current) { loadInFlightRef.current = false; if (!background) setLoading(false); } }
  }, []);
  // Read the saved company schedule once before enabling any writes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); return () => { requestRef.current += 1; loadInFlightRef.current = false; }; }, [load]);
  useChangeSync(useCallback(topics => { if (topics.includes('post_production')) load(true); }, [load]), syncEnabled);
  const change = updater => { dirtyRef.current = true; setDirty(true); setDraft(updater); setNotice(''); setError(''); };
  const changeWindow = (rowId, values) => change(current => ({ ...current, windows: current.windows.map(window => window.rowId === rowId ? { ...window, ...values } : window) }));
  const save = async event => {
    event.preventDefault();
    if (!loaded || loading || savingRef.current || conflict) return;
    try { validateCompanyPickupSchedule(draft); } catch (validationError) { setError(validationError.message); return; }
    const requestId = ++requestRef.current;
    // A save supersedes any background read; that stale read must not keep refresh locked.
    loadInFlightRef.current = false;
    savingRef.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const { data, error: requestError } = await dataClient.request('/post-production/pickup-schedule', { method: 'PUT', body: JSON.stringify({ expected_revision: revisionRef.current, enabled: draft.enabled, note: draft.note.trim(), windows: draft.windows.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })) }) });
      if (requestId !== requestRef.current) return;
      if (requestError) { setError(requestError.message || 'تعذر حفظ الجدول. تعديلاتك محفوظة في النافذة ويمكنك إعادة المحاولة.'); if (requestError.code === 'pickup_revision_conflict' || requestError.status === 409) setConflict(true); return; }
      const next = normalizeSchedule(data);
      setDraft(withRowIds(next)); revisionRef.current = Number(next.revision); dirtyRef.current = false; setDirty(false); setConflict(false); setLatestSaved(null);
      setNotice(next.enabled ? 'تم حفظ مواعيد الاستلام لجميع العملاء. ستتكرر أسبوعيًا حتى تغيّرها.' : 'تم إيقاف عرض مواعيد الاستلام. احتفظنا بالفترات لتفعيلها لاحقًا.');
    } catch { if (requestId === requestRef.current) setError('تعذر الاتصال أثناء الحفظ. لم تُحذف تعديلاتك؛ يمكنك إعادة المحاولة.'); }
    finally { savingRef.current = false; if (requestId === requestRef.current) setSaving(false); }
  };

  return <section className="company-pickup-editor" aria-labelledby="company-pickup-editor-title" dir="rtl" aria-busy={loading || saving}>
    <header className="company-pickup-editor__head"><div><span>جدول واحد لكل العملاء</span><h2 id="company-pickup-editor-title">مواعيد الاستلام الأسبوعية</h2><p>حدد الأيام والساعات مرة واحدة. تظهر أعلى صفحة التسليمات لدى كل عميل، وتستمر حتى تغيّرها.</p></div><button type="button" onClick={() => load()} disabled={loading || saving} aria-label="تحديث جدول الاستلام مع الاحتفاظ بالتعديلات"><RefreshCw className={loading ? 'is-spinning' : ''} /> تحديث</button></header>
    {loading && <p className="company-pickup-editor__message" role="status">جارٍ تحميل مواعيد الاستلام المحفوظة…</p>}
    {error && <p className="company-pickup-editor__message is-error" role="alert">{error}</p>}
    {notice && <p className="company-pickup-editor__message is-success" role="status"><Check aria-hidden="true" />{notice}</p>}
    {conflict && <div className="company-pickup-editor__conflict" role="alert"><strong>تم تغيير الجدول من مكان آخر.</strong><p>لم تُحذف تعديلاتك. حمّل أحدث نسخة قبل إعادة حفظها.</p><button type="button" onClick={() => load()} disabled={loading || saving}>تحميل أحدث نسخة مع الاحتفاظ بتعديلاتي</button></div>}
    {!loaded && !loading && <button type="button" onClick={() => load()}>إعادة تحميل الجدول</button>}
    {loaded && <form onSubmit={save}>
      <fieldset disabled={loading || saving}>
        <label className="company-pickup-editor__toggle"><input type="checkbox" checked={draft.enabled} onChange={event => change(current => ({ ...current, enabled: event.target.checked }))} /><span><strong>إظهار مواعيد الاستلام للعملاء</strong><small>عند الإيقاف، تُحفظ الفترات وتُخفى عن العملاء.</small></span><b>{draft.enabled ? 'مفعّل' : 'متوقف'}</b></label>
        <div className="company-pickup-editor__windows">{draft.windows.map((window, index) => <div className="company-pickup-editor__window" key={window.rowId}><label>اليوم<select aria-label={`يوم الفترة ${index + 1}`} value={window.weekday} onChange={event => changeWindow(window.rowId, { weekday: Number(event.target.value) })}>{PICKUP_DAY_ORDER.map(day => <option key={day} value={day}>{PICKUP_WEEKDAYS[day]}</option>)}</select></label><label>من<BusinessTimeSelect required min="00:00" max="23:59" step={1} aria-label={`بداية الفترة ${index + 1}`} value={window.start_time} onChange={event => changeWindow(window.rowId, { start_time: event.target.value })} /></label><label>إلى<BusinessTimeSelect required min="00:00" max="23:59" step={1} aria-label={`نهاية الفترة ${index + 1}`} value={window.end_time} onChange={event => changeWindow(window.rowId, { end_time: event.target.value })} /></label><button type="button" className="company-pickup-editor__remove" aria-label={`حذف الفترة ${index + 1}`} onClick={() => change(current => ({ ...current, windows: current.windows.filter(item => item.rowId !== window.rowId) }))}><Trash2 aria-hidden="true" /></button></div>)}</div>
        {!draft.windows.length && <p className="company-pickup-editor__empty">لم تضف أيامًا بعد. ابدأ بإضافة فترة الاستلام المناسبة للشركة.</p>}
        <button type="button" className="company-pickup-editor__add" disabled={draft.windows.length >= 21} onClick={() => { const rowId = ++rowIdRef.current; change(current => ({ ...current, windows: [...current.windows, { weekday: 6, start_time: '14:00', end_time: '18:00', rowId }] })); }}><Plus aria-hidden="true" /> إضافة يوم / فترة استلام</button>
        <label className="company-pickup-editor__note">ملاحظة تظهر للعملاء (اختياري)<textarea rows="2" maxLength="500" value={draft.note} placeholder="مثال: يرجى إحضار وحدة تخزين مناسبة لاستلام الملفات." onChange={event => change(current => ({ ...current, note: event.target.value }))} /><small>{draft.note.length} / 500</small></label>
      </fieldset>
      {latestSaved && <details className="company-pickup-editor__comparison" open><summary>آخر مواعيد محفوظة — للمقارنة مع تعديلاتك أدناه</summary><CompanyPickupSchedule schedule={latestSaved} /><p>الحفظ سيستبدل هذه المواعيد بالتعديلات الموجودة في المعاينة التالية.</p></details>}
      <CompanyPickupSchedule schedule={draft} preview />
      <footer className="company-pickup-editor__actions"><p>{dirty ? 'لديك تعديلات لم تُحفظ بعد.' : 'الجدول المحفوظ يتكرر أسبوعيًا بدون تاريخ انتهاء.'}</p><button type="submit" className="company-pickup-editor__save" disabled={!loaded || loading || saving || conflict || !dirty}><Save aria-hidden="true" />{saving ? 'جارٍ الحفظ…' : 'حفظ المواعيد لكل العملاء'}</button></footer>
    </form>}
  </section>;
}
