import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ChevronLeft, Clock3, Download, Edit3, Plus, Settings2, TimerOff, UserRoundCheck, X } from 'lucide-react';
import { dataProvider } from '../dataClient';
import { useData } from '../store/DataContext';
import { attendanceApi } from '../lib/attendanceApi';
import { formatDurationMinutes, formatEGP, formatTime12, normalizeTime } from '../lib/businessFormat';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import './ERPAttendance.css';
import './ERPAttendanceResponsive.css';
import ERPPageHero from './ERPPageHero';
import EmployeeFinanceAccounts from './EmployeeFinanceAccounts';

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
const money = formatEGP;
const roleLabels = { owner: 'مالك', admin: 'مدير', operations: 'تشغيل', finance: 'مالية', staff: 'موظف' };
const statusLabels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', authorized_leave: 'إجازة / غياب مصرح', early_leave: 'انصراف مبكر', day_off: 'يوم راحة', open: 'سجل مفتوح' };
const weekDays = [{ id: 0, label: 'ح' }, { id: 1, label: 'ن' }, { id: 2, label: 'ث' }, { id: 3, label: 'ر' }, { id: 4, label: 'خ' }, { id: 5, label: 'ج' }, { id: 6, label: 'س' }];
const toDateTimeLocal = (value) => value ? String(value).slice(0, 16).replace(' ', 'T') : '';
const toMySqlDateTime = (value) => value ? `${value.replace('T', ' ')}:00` : null;
const lateBillableUnits = (item) => {
  const provided = Number(item?.late_billable_half_hours);
  if (Number.isFinite(provided) && provided >= 0) return provided;
  const actualMinutes = Number(item?.late_minutes || 0);
  return actualMinutes > 15 ? Math.ceil(actualMinutes / 30) : 0;
};
const lateBillableMinutes = (item) => {
  const provided = Number(item?.late_billable_minutes);
  return Number.isFinite(provided) && provided >= 0 ? provided : lateBillableUnits(item) * 30;
};

const previewPayload = () => ({
  summary: { month: currentMonth(), items: [
    { user_id: 3, full_name: 'كريم حسن', role: 'operations', track_attendance: 1, present_days: 18, late_minutes: 47, late_billable_half_hours: 2, late_billable_minutes: 60, early_leave_minutes: 20, absent_days: 1, monthly_salary: 9000, late_deduction: 20, early_leave_deduction: 58, absence_deduction: 346, manual_adjustment: 100, total_deduction: 524, estimated_net: 8476 },
    { user_id: 4, full_name: 'ليلى عمر', role: 'staff', track_attendance: 1, present_days: 17, late_minutes: 92, late_billable_half_hours: 4, late_billable_minutes: 120, early_leave_minutes: 0, absent_days: 2, monthly_salary: 7500, late_deduction: 40, early_leave_deduction: 0, absence_deduction: 577, manual_adjustment: 0, total_deduction: 617, estimated_net: 6883 },
  ] },
  policies: [
    { user_id: 3, full_name: 'كريم حسن', role: 'operations', track_attendance: 1, scheduled_start: '12:00:00', scheduled_end: '21:00:00', working_weekdays: '[0,1,2,3,4,6]', grace_minutes: 15, monthly_salary: 9000, expected_working_days: 26, absence_multiplier: 1, late_multiplier: 1, early_leave_deduction_enabled: 1 },
    { user_id: 4, full_name: 'ليلى عمر', role: 'staff', track_attendance: 1, scheduled_start: '12:00:00', scheduled_end: '21:00:00', working_weekdays: '[0,1,2,3,4,6]', grace_minutes: 15, monthly_salary: 7500, expected_working_days: 26, absence_multiplier: 1, late_multiplier: 1, early_leave_deduction_enabled: 0 },
  ],
});

const previewDetails = userId => {
  const day = offset => { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };
  const late = Number(userId) === 4;
  return {
    records: [
      { id: Number(userId) * 100 + 1, user_id: userId, work_date: day(-1), scheduled_start: '12:00:00', scheduled_end: '21:00:00', check_in_at: `${day(-1)} ${late ? '12:31:00' : '12:08:00'}`, check_out_at: `${day(-1)} 21:05:00`, status: late ? 'late' : 'present', late_minutes: late ? 31 : 0, late_billable_half_hours: late ? 2 : 0, late_billable_minutes: late ? 60 : 0, early_leave_minutes: 0 },
      { id: Number(userId) * 100 + 2, user_id: userId, work_date: day(-2), scheduled_start: '12:00:00', scheduled_end: '21:00:00', check_in_at: `${day(-2)} 12:12:00`, check_out_at: `${day(-2)} 20:40:00`, status: 'early_leave', late_minutes: 0, early_leave_minutes: 20 },
      { id: Number(userId) * 100 + 3, user_id: userId, work_date: day(-3), scheduled_start: '12:00:00', scheduled_end: '21:00:00', check_in_at: null, check_out_at: null, status: 'absent', late_minutes: 0, early_leave_minutes: 0 },
    ],
    adjustments: [{ id: Number(userId) * 10 + 1, adjustment_type: 'deduction', amount: 100, minutes: 0, reason: 'تسوية إدارية تجريبية', created_at: `${day(-2)} 18:00:00`, voided_at: null, replacement_adjustment_id: null }],
  };
};

const ERPAttendance = () => {
  const { currentUser } = useData();
  const isOwner = currentUser?.role === 'owner';
  const canManageEmployeeFinance = ['owner', 'admin'].includes(currentUser?.role);
  const isPreview = currentUser?.is_local_preview || dataProvider !== 'hostinger';
  const [month, setMonth] = useState(currentMonth());
  const [statusFilter, setStatusFilter] = useState('all');
  const [summary, setSummary] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState({ loading: false, records: [], adjustments: [] });
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [manualRecord, setManualRecord] = useState(null);
  const [adjustment, setAdjustment] = useState({ type: 'deduction', amount: '', reason: '' });
  const [adjustmentCorrection, setAdjustmentCorrection] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (isPreview) {
      const preview = previewPayload(currentUser); setSummary(preview.summary.items); setPolicies(preview.policies); setToday({ self: { tracked: false } }); setLoading(false); return;
    }
    try {
      // Login is authoritative; this idempotent call also keeps the attendance page current.
      await attendanceApi.checkIn();
      const [summaryData, policyData, todayData] = await Promise.all([attendanceApi.summary(month), attendanceApi.policies(), attendanceApi.today()]);
      setSummary(summaryData.items || []); setPolicies(Array.isArray(policyData) ? policyData : [policyData]); setToday(todayData);
    } catch (requestError) { setError(requestError.message || 'تعذر تحميل بيانات الحضور.'); }
    finally { setLoading(false); }
  }, [currentUser, isPreview, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openDetails = async (employee) => {
    setSelected(employee); setDetails({ loading: true, records: [], adjustments: [] });
    if (isPreview) { setDetails({ loading: false, ...previewDetails(employee.user_id) }); return; }
    try { const data = await attendanceApi.records(month, employee.user_id); setDetails({ loading: false, records: data.records || [], adjustments: data.adjustments || [] }); }
    catch (requestError) { setDetails({ loading: false, records: [], adjustments: [], error: requestError.message }); }
  };

  const startPolicyEdit = (employee) => {
    const stored = policies.find((policy) => String(policy.user_id) === String(employee.user_id)) || employee;
    let weekdays = stored.working_weekdays;
    if (typeof weekdays === 'string') { try { weekdays = JSON.parse(weekdays); } catch { weekdays = [0, 1, 2, 3, 4]; } }
    setEditingPolicy({ user_id: employee.user_id, full_name: employee.full_name, track_attendance: true, scheduled_start: '12:00', scheduled_end: normalizeTime(stored.scheduled_end || '24:00', { endOfDay: true }), working_weekdays: weekdays || [0, 1, 2, 3, 4], grace_minutes: 15, monthly_salary: Number(stored.monthly_salary || 0), expected_working_days: Number(stored.expected_working_days || 26), absence_multiplier: Number(stored.absence_multiplier || 1), late_multiplier: 1, early_leave_deduction_enabled: Boolean(Number(stored.early_leave_deduction_enabled)) });
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    const fixedPolicy = { ...editingPolicy, track_attendance: true, scheduled_start: '12:00', grace_minutes: 15, late_multiplier: 1 };
    if (isPreview) {
      setPolicies(current => current.map(policy => String(policy.user_id) === String(fixedPolicy.user_id) ? { ...policy, ...fixedPolicy, track_attendance: 1, working_weekdays: JSON.stringify(fixedPolicy.working_weekdays) } : policy));
      setSummary(current => current.map(employee => String(employee.user_id) === String(fixedPolicy.user_id) ? { ...employee, track_attendance: 1, monthly_salary: Number(fixedPolicy.monthly_salary || 0) } : employee));
      setEditingPolicy(null);
      setError('');
      return;
    }
    setSaving(true);
    try { await attendanceApi.savePolicy(fixedPolicy); setEditingPolicy(null); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر حفظ سياسة الحضور.'); }
    finally { setSaving(false); }
  };

  const saveCorrection = async (event) => {
    event.preventDefault();
    const checkIn = correction.check_in_at ? new Date(toDateTimeLocal(correction.check_in_at)) : null;
    const checkOut = correction.check_out_at ? new Date(toDateTimeLocal(correction.check_out_at)) : null;
    if (checkIn && Number.isNaN(checkIn.getTime())) { setError('وقت الدخول غير صحيح.'); return; }
    if (checkOut && Number.isNaN(checkOut.getTime())) { setError('وقت الانصراف غير صحيح.'); return; }
    if (checkIn && correction.check_in_at.slice(0, 10) !== correction.work_date) { setError('وقت الدخول يجب أن يكون في يوم السجل نفسه.'); return; }
    if (checkOut && correction.check_out_at.slice(0, 10) !== correction.work_date) { setError('وقت الانصراف يجب أن يكون في يوم السجل نفسه.'); return; }
    if (checkIn && checkOut && checkOut < checkIn) { setError('وقت الانصراف لا يمكن أن يسبق وقت الدخول.'); return; }
    if (isPreview) {
      setDetails(current => ({ ...current, records: current.records.map(record => Number(record.id) === Number(correction.id) ? { ...record, check_in_at: toMySqlDateTime(correction.check_in_at), check_out_at: toMySqlDateTime(correction.check_out_at), correction_reason: correction.correction_reason, status: 'present', late_minutes: 0, early_leave_minutes: 0 } : record) }));
      setCorrection(null);
      setError('');
      return;
    }
    setSaving(true);
    try { await attendanceApi.correctRecord(correction.id, { check_in_at: toMySqlDateTime(correction.check_in_at), check_out_at: toMySqlDateTime(correction.check_out_at), correction_reason: correction.correction_reason }); setCorrection(null); await openDetails(selected); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر تعديل السجل.'); }
    finally { setSaving(false); }
  };

  const saveAdjustment = async (event) => {
    event.preventDefault();
    const enteredAmount = Number(adjustment.amount || 0);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) { setError('أدخل مبلغًا موجبًا أكبر من صفر.'); return; }
    const amount = adjustment.type === 'deduction' ? enteredAmount : -enteredAmount;
    if (isPreview) {
      setDetails(current => ({ ...current, adjustments: [{ id: Date.now(), adjustment_type: amount > 0 ? 'deduction' : 'credit', amount, minutes: 0, reason: adjustment.reason, created_at: new Date().toISOString() }, ...current.adjustments] }));
      setSummary(current => current.map(employee => String(employee.user_id) === String(selected.user_id) ? { ...employee, manual_adjustment: Number(employee.manual_adjustment || 0) + amount, total_deduction: Number(employee.total_deduction || 0) + amount, estimated_net: Number(employee.estimated_net || 0) - amount } : employee));
      setAdjustment({ type: 'deduction', amount: '', reason: '' });
      setError('');
      return;
    }
    setSaving(true);
    try { await attendanceApi.addAdjustment({ user_id: selected.user_id, month, amount, reason: adjustment.reason }); setAdjustment({ type: 'deduction', amount: '', reason: '' }); await openDetails(selected); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر حفظ التسوية.'); }
    finally { setSaving(false); }
  };

  const openManualRecord = () => {
    const policy = policies.find(item => String(item.user_id) === String(selected.user_id)) || {};
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
    const date = today.startsWith(month) ? today : `${month}-01`;
    const start = normalizeTime(policy.scheduled_start || '12:00');
    const end = normalizeTime(policy.scheduled_end || '21:00', { endOfDay: true }) === '24:00' ? '23:59' : normalizeTime(policy.scheduled_end || '21:00', { endOfDay: true });
    setManualRecord({ user_id: selected.user_id, work_date: date, status: 'present', check_in_at: `${date}T${start}`, check_out_at: `${date}T${end}`, notes: '', correction_reason: '' });
  };

  const saveManualRecord = async event => {
    event.preventDefault(); const withoutTimes = ['absent', 'authorized_leave'].includes(manualRecord.status);
    const values = { ...manualRecord, check_in_at: withoutTimes ? null : toMySqlDateTime(manualRecord.check_in_at), check_out_at: withoutTimes ? null : toMySqlDateTime(manualRecord.check_out_at) };
    setSaving(true); setError('');
    try {
      if (isPreview) {
        const existing = details.records.find(record => record.work_date === values.work_date);
        const row = { ...(existing || {}), id: existing?.id || Date.now(), work_date: values.work_date, check_in_at: values.check_in_at, check_out_at: values.check_out_at, status: values.status, notes: values.notes, correction_reason: values.correction_reason, late_minutes: 0, early_leave_minutes: 0 };
        setDetails(current => ({ ...current, records: [row, ...current.records.filter(record => record.work_date !== values.work_date)].sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))) }));
      } else {
        await attendanceApi.saveManualRecord(values); await openDetails(selected); await load();
      }
      setManualRecord(null);
    } catch (requestError) { setError(requestError.message || 'تعذر حفظ يوم الحضور اليدوي.'); }
    finally { setSaving(false); }
  };

  const saveAdjustmentCorrection = async (event) => {
    event.preventDefault();
    const enteredAmount = Number(adjustmentCorrection.amount || 0);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) { setError('أدخل مبلغًا بديلًا موجبًا أكبر من صفر.'); return; }
    const amount = adjustmentCorrection.type === 'deduction' ? enteredAmount : -enteredAmount;
    const values = { amount, minutes: Number(adjustmentCorrection.minutes || 0), entry_reason: adjustmentCorrection.entry_reason, correction_reason: adjustmentCorrection.correction_reason };
    setSaving(true); setError('');
    try {
      if (isPreview) {
        const replacementId = Date.now();
        setDetails(current => ({ ...current, adjustments: [{ id: replacementId, adjustment_type: amount > 0 ? 'deduction' : 'credit', amount, minutes: values.minutes, reason: values.entry_reason, created_at: new Date().toISOString(), voided_at: null }, ...current.adjustments.map(item => Number(item.id) === Number(adjustmentCorrection.id) ? { ...item, voided_at: new Date().toISOString(), void_reason: values.correction_reason, replacement_adjustment_id: replacementId } : item)] }));
      } else {
        await attendanceApi.correctAdjustment(adjustmentCorrection.id, values);
        await openDetails(selected); await load();
      }
      setAdjustmentCorrection(null);
    } catch (requestError) { setError(requestError.message || 'تعذر تصحيح تسوية الحضور.'); }
    finally { setSaving(false); }
  };

  const handleCheckout = async () => {
    if (isPreview) {
      setToday(current => ({ ...current, self: { ...(current?.self || {}), tracked: true, record: { ...(current?.self?.record || {}), check_out_at: new Date().toISOString(), status: 'present' } } }));
      return;
    }
    try { await attendanceApi.checkOut(); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر تسجيل الانصراف.'); }
  };

  const totals = useMemo(() => summary.reduce((acc, item) => ({
    tracked: acc.tracked + (item.track_attendance ? 1 : 0), present: acc.present + Number(item.present_days || 0), late: acc.late + Number(item.late_minutes || 0), absent: acc.absent + Number(item.absent_days || 0), deduction: acc.deduction + Number(item.total_deduction || 0), net: acc.net + Number(item.estimated_net || 0),
  }), { tracked: 0, present: 0, late: 0, absent: 0, deduction: 0, net: 0 }), [summary]);
  const filtered = summary.filter((item) => statusFilter === 'all' || (statusFilter === 'late' && item.late_minutes > 0) || (statusFilter === 'absent' && item.absent_days > 0) || (statusFilter === 'exempt' && !item.track_attendance));
  const selfRecord = today?.self?.record;

  return (
    <main className="attendance-page">
      <ERPPageHero
        icon={CalendarClock}
        eyebrow="الوقت والرواتب"
        title="الحضور والرواتب"
        description="يُسجل حضور الموظف عند الدخول، وتظهر الخصومات والتسويات بوضوح قبل اعتماد الراتب."
        details={<div className="attendance-head__tools"><label>الشهر<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>{selfRecord && !selfRecord.check_out_at && <button className="attendance-checkout" onClick={handleCheckout}><TimerOff size={17} /> تسجيل الانصراف</button>}</div>}
      />

      {isPreview && <div className="attendance-preview"><AlertTriangle size={17} /><div><strong>وضع معاينة محلية</strong><span>يمكنك مراجعة الشكل والسياسات؛ التسجيل والحفظ الفعليان يعملان بعد تشغيل API وقاعدة Hostinger.</span></div></div>}
      {error && <div className="attendance-error" role="alert"><AlertTriangle size={17} />{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

      <section className="attendance-rule" aria-label="قاعدة احتساب التأخير">
        <div className="attendance-rule__formula">
          <span><Clock3 size={15} /><small>بداية الدوام</small><strong>12:00 ظهرًا</strong></span>
          <ChevronLeft aria-hidden="true" />
          <span><small>فترة مجانية</small><strong>سماح 15 دقيقة</strong></span>
          <ChevronLeft aria-hidden="true" />
          <span className="attendance-rule__penalty"><small>بعد السماح</small><strong>كل 30 دقيقة بدأت = 10 ج.م</strong></span>
        </div>
        <p><AlertTriangle size={14} /> المالك والعملاء غير خاضعين لحساب الحضور.</p>
      </section>

      <section className="attendance-strip" aria-label="ملخص الشهر">
        <div><span>موظفون خاضعون</span><strong>{loading ? '—' : totals.tracked}</strong><small>من {summary.length} حساب عمل</small></div>
        <div><span>أيام الحضور</span><strong>{loading ? '—' : totals.present}</strong><small><UserRoundCheck size={14} /> سجلات الشهر</small></div>
        <div><span>إجمالي التأخير الفعلي</span><strong>{loading ? '—' : `${totals.late} د`}</strong><small><Clock3 size={14} /> السماح 15 دقيقة</small></div>
        <div><span>أيام الغياب</span><strong>{loading ? '—' : totals.absent}</strong><small>حتى يوم أمس فقط</small></div>
        <div><span>الخصومات المقدرة</span><strong>{loading ? '—' : money(totals.deduction)}</strong><small>من الخادم، قبل اعتماد الراتب</small></div>
      </section>

      <EmployeeFinanceAccounts month={month} canManage={canManageEmployeeFinance} />

      <section className="attendance-workspace">
        <div className="attendance-toolbar"><div className="attendance-filters" role="group" aria-label="تصفية الموظفين">{[['all', 'الكل'], ['late', 'لديه تأخير'], ['absent', 'لديه غياب'], ['exempt', 'معفي']].map(([value, label]) => <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{label}</button>)}</div><button className="attendance-export" type="button" onClick={() => window.print()}><Download size={15} /> طباعة التقرير</button></div>
        {loading ? <div className="attendance-loading">جارٍ تجهيز تقرير الشهر…</div> : filtered.length === 0 ? <div className="attendance-empty"><CalendarClock size={34} /><h2>لا توجد نتائج</h2><p>غيّر الفلتر أو اختر شهرًا آخر.</p></div> : (
          <>
            <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>الموظف</th><th>السياسة</th><th>الحضور</th><th>التأخير</th><th>الغياب</th><th>الخصومات</th><th>صافي تقديري</th><th><span className="sr-only">إجراءات</span></th></tr></thead><tbody>{filtered.map((employee) => <tr key={employee.user_id}><td><strong>{employee.full_name}</strong><small>{roleLabels[employee.role] || employee.role}</small></td><td>{employee.track_attendance ? <span className="status status--present">مفعلة</span> : <span className="status status--off">معفي</span>}</td><td>{employee.present_days}</td><td className={employee.late_minutes ? 'warn' : ''}><strong>{formatDurationMinutes(employee.late_minutes, { compact: true })}</strong><small>{lateBillableUnits(employee) ? `${lateBillableUnits(employee)} × 10 ج.م` : 'بدون خصم'}</small></td><td className={employee.absent_days ? 'danger' : ''}>{employee.absent_days}</td><td>{money(employee.total_deduction)}</td><td><strong>{money(employee.estimated_net)}</strong></td><td><div className="row-actions">{isOwner && <button title="إعداد السياسة" aria-label={`إعداد سياسة ${employee.full_name}`} onClick={() => startPolicyEdit(employee)}><Settings2 size={16} /></button>}<button title="عرض الأيام" aria-label={`عرض أيام ${employee.full_name}`} onClick={() => openDetails(employee)}><ChevronLeft size={17} /></button></div></td></tr>)}</tbody></table></div>
            <div className="attendance-mobile-list">{filtered.map((employee) => <article key={employee.user_id} className="attendance-employee-card"><header><div><strong>{employee.full_name}</strong><small>{roleLabels[employee.role] || employee.role}</small></div>{employee.track_attendance ? <span className="status status--present">مفعلة</span> : <span className="status status--off">معفي</span>}</header><dl><div><dt>الحضور</dt><dd>{employee.present_days} يوم</dd></div><div><dt>التأخير</dt><dd className={employee.late_minutes ? 'warn' : ''}>{formatDurationMinutes(employee.late_minutes, { compact: true })}<small>{lateBillableUnits(employee) ? `${lateBillableUnits(employee)} فترة × 10 ج.م` : 'بدون خصم'}</small></dd></div><div><dt>الغياب</dt><dd className={employee.absent_days ? 'danger' : ''}>{employee.absent_days} يوم</dd></div><div><dt>الخصومات</dt><dd>{money(employee.total_deduction)}</dd></div><div><dt>صافي تقديري</dt><dd>{money(employee.estimated_net)}</dd></div></dl><footer>{isOwner && <button aria-label={`إعداد سياسة ${employee.full_name}`} onClick={() => startPolicyEdit(employee)}><Settings2 size={15} /> إعداد السياسة</button>}<button aria-label={`عرض أيام ${employee.full_name}`} onClick={() => openDetails(employee)}><CalendarClock size={15} /> عرض الأيام</button></footer></article>)}</div>
          </>
        )}
      </section>

      {selected && <div className="attendance-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
        <aside className="attendance-drawer" role="dialog" aria-modal="true" aria-label={`تفاصيل حضور ${selected.full_name}`}>
          <header><div><span>{month}</span><h2>{selected.full_name}</h2><p>{roleLabels[selected.role]} · خصم مقدر {money(selected.total_deduction)}</p></div><button onClick={() => setSelected(null)} aria-label="إغلاق"><X size={20} /></button></header>
          <div className="drawer-breakdown"><div className="drawer-breakdown__late"><span>التأخير الفعلي</span><strong>{formatDurationMinutes(selected.late_minutes)}</strong><small>{lateBillableUnits(selected)} فترة محاسبة ({formatDurationMinutes(lateBillableMinutes(selected))}) × 10 ج.م = {money(selected.late_deduction ?? lateBillableUnits(selected) * 10)}</small></div><div><span>غياب</span><strong>{selected.absent_days} يوم</strong><small>{money(selected.absence_deduction)}</small></div><div><span>انصراف مبكر</span><strong>{formatDurationMinutes(selected.early_leave_minutes)}</strong><small>{money(selected.early_leave_deduction)}</small></div><div><span>تسويات</span><strong>{money(selected.manual_adjustment)}</strong><small>بسبب مسجل</small></div></div>
          <section className="drawer-section"><div className="attendance-section-heading"><h3>السجل اليومي</h3>{isOwner && <button type="button" onClick={openManualRecord}><Plus size={15}/> إضافة حضور أو غياب</button>}</div>{details.loading ? <p className="drawer-note">جارٍ التحميل…</p> : details.error ? <p className="drawer-note drawer-note--error">{details.error}</p> : details.records.length === 0 ? <p className="drawer-note">لا توجد أيام مسجلة في هذا الشهر.</p> : <div className="daily-records">{details.records.map((record) => <div key={record.id}><time>{record.work_date}</time><span className={`status status--${record.status}`}>{statusLabels[record.status] || record.status}{record.correction_reason ? ' · معدل يدويًا' : ''}</span><bdi>{record.check_in_at ? formatTime12(record.check_in_at) : '—'} → {record.check_out_at ? formatTime12(record.check_out_at) : ['absent','authorized_leave'].includes(record.status) ? 'بدون حضور' : 'سجل مفتوح'}</bdi>{isOwner && <button onClick={() => setCorrection({ ...record, check_in_at: record.check_in_at?.slice(0, 16) || '', check_out_at: record.check_out_at?.slice(0, 16) || '', correction_reason: '' })}><Edit3 size={14} /> تعديل</button>}</div>)}</div>}</section>
          <section className="drawer-section"><h3>سجل التسويات المالية</h3>{details.adjustments.length === 0 ? <p className="drawer-note">لا توجد تسويات لهذا الشهر.</p> : <div className="attendance-adjustments">{details.adjustments.map(item => <article key={item.id} className={item.voided_at ? 'is-voided' : ''}><div><strong className={item.adjustment_type === 'credit' || Number(item.amount) < 0 ? 'adjustment-credit' : 'adjustment-deduction'}>{item.adjustment_type === 'credit' || Number(item.amount) < 0 ? 'تخفيض الخصومات' : 'خصم من الراتب'} · {money(Math.abs(Number(item.amount)))}</strong><span>{item.reason}</span><small>{String(item.created_at || '').slice(0, 16).replace('T', ' ')}{item.voided_at ? ` · مُبطلة: ${item.void_reason || 'تصحيح موثق'}` : ''}</small></div>{isOwner && !item.voided_at && <button type="button" onClick={() => setAdjustmentCorrection({ ...item, type: item.adjustment_type === 'credit' || Number(item.amount) < 0 ? 'credit' : 'deduction', amount: Math.abs(Number(item.amount)), minutes: item.minutes || 0, entry_reason: item.reason || '', correction_reason: '' })}><Edit3 size={14} /> تصحيح</button>}</article>)}</div>}</section>
          {isOwner && <section className="drawer-section"><h3>إضافة تسوية مالية</h3><form className="adjustment-form" onSubmit={saveAdjustment}><fieldset className="adjustment-kind"><legend>نوع التسوية</legend><label className="adjustment-kind__deduction"><input type="radio" name="adjustment-type" value="deduction" checked={adjustment.type === 'deduction'} onChange={(event) => setAdjustment((old) => ({ ...old, type: event.target.value }))} /><span>خصم من الراتب</span></label><label className="adjustment-kind__credit"><input type="radio" name="adjustment-type" value="credit" checked={adjustment.type === 'credit'} onChange={(event) => setAdjustment((old) => ({ ...old, type: event.target.value }))} /><span>تخفيض الخصومات</span></label></fieldset><label>المبلغ بالجنيه<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={adjustment.amount} onChange={(event) => setAdjustment((old) => ({ ...old, amount: event.target.value }))} placeholder="0.00" /></label><label>شهر التسوية<input type="month" value={month} readOnly aria-readonly="true" /></label><label className="adjustment-reason">السبب<input required minLength="5" value={adjustment.reason} onChange={(event) => setAdjustment((old) => ({ ...old, reason: event.target.value }))} placeholder="مثال: إذن معتمد من الإدارة" /></label><button className={adjustment.type === 'credit' ? 'adjustment-save adjustment-save--credit' : 'adjustment-save'} disabled={saving}>{saving ? 'جارٍ الحفظ…' : adjustment.type === 'credit' ? 'حفظ تخفيض الخصومات' : 'حفظ الخصم'}</button></form></section>}
        </aside>
      </div>}

      {editingPolicy && <div className="attendance-overlay" role="presentation"><form className="policy-modal" role="dialog" aria-modal="true" onSubmit={savePolicy}><header><div><span>سياسة الموظف</span><h2>{editingPolicy.full_name}</h2></div><button type="button" onClick={() => setEditingPolicy(null)} aria-label="إغلاق"><X size={20} /></button></header><div className="policy-fixed-rules" aria-label="قواعد حضور ثابتة"><div><UserRoundCheck size={17} /><span>تسجيل الحضور</span><strong>مفعّل لكل الموظفين</strong></div><div><Clock3 size={17} /><span>بداية الدوام</span><strong>12:00 ظهرًا</strong></div><div><CalendarClock size={17} /><span>فترة السماح</span><strong>15 دقيقة</strong></div></div><p className="policy-fixed-note">قواعد ثابتة: بعد السماح يُحسب كل نصف ساعة بدأت بقيمة 10 ج.م.</p><div className="policy-grid"><label>نهاية الدوام<BusinessTimeSelect min="13:00" max="24:00" required value={editingPolicy.scheduled_end} onChange={(event) => setEditingPolicy((old) => ({ ...old, scheduled_end: event.target.value }))} /></label><label>الراتب الشهري<input type="number" min="0" step="0.01" value={editingPolicy.monthly_salary} onChange={(event) => setEditingPolicy((old) => ({ ...old, monthly_salary: Number(event.target.value) }))} /></label><label>أيام العمل المتوقعة<input type="number" min="1" max="31" value={editingPolicy.expected_working_days} onChange={(event) => setEditingPolicy((old) => ({ ...old, expected_working_days: Number(event.target.value) }))} /></label><label>معامل الغياب<input type="number" min="0" step="0.25" value={editingPolicy.absence_multiplier} onChange={(event) => setEditingPolicy((old) => ({ ...old, absence_multiplier: Number(event.target.value) }))} /></label><label className="policy-checkbox"><input type="checkbox" checked={editingPolicy.early_leave_deduction_enabled} onChange={(event) => setEditingPolicy((old) => ({ ...old, early_leave_deduction_enabled: event.target.checked }))} /> خصم الانصراف المبكر</label></div><fieldset><legend>أيام العمل</legend><div className="weekday-picker">{weekDays.map((day) => <label key={day.id}><input type="checkbox" checked={editingPolicy.working_weekdays.includes(day.id)} onChange={(event) => setEditingPolicy((old) => ({ ...old, working_weekdays: event.target.checked ? [...old.working_weekdays, day.id].sort() : old.working_weekdays.filter((value) => value !== day.id) }))} /><span>{day.label}</span></label>)}</div></fieldset><footer><button type="button" onClick={() => setEditingPolicy(null)}>إلغاء</button><button className="primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ السياسة'}</button></footer></form></div>}

      {manualRecord && <div className="attendance-overlay"><form className="correction-modal" onSubmit={saveManualRecord}><header><div><span>صلاحية المالك · سجل موثق</span><h2>إضافة حضور أو غياب</h2></div><button type="button" onClick={() => setManualRecord(null)} aria-label="إغلاق إضافة يوم الحضور"><X size={20}/></button></header><div className="policy-grid"><label>اليوم<input type="date" required value={manualRecord.work_date} onChange={event => { const date = event.target.value; setManualRecord(old => ({ ...old, work_date: date, check_in_at: old.check_in_at ? `${date}T${old.check_in_at.slice(11, 16)}` : '', check_out_at: old.check_out_at ? `${date}T${old.check_out_at.slice(11, 16)}` : '' })); }}/></label><label>الحالة<select value={manualRecord.status} onChange={event => setManualRecord(old => ({ ...old, status: event.target.value }))}>{['present','late','early_leave','absent','authorized_leave'].map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label></div>{!['absent','authorized_leave'].includes(manualRecord.status) && <div className="policy-grid"><label>وقت الدخول<input type="datetime-local" required value={manualRecord.check_in_at} onChange={event => setManualRecord(old => ({ ...old, check_in_at: event.target.value }))}/></label><label>وقت الانصراف<input type="datetime-local" required value={manualRecord.check_out_at} onChange={event => setManualRecord(old => ({ ...old, check_out_at: event.target.value }))}/></label></div>}<label>ملاحظات<input value={manualRecord.notes} onChange={event => setManualRecord(old => ({ ...old, notes: event.target.value }))} placeholder="اختياري"/></label><label>سبب التسجيل أو التصحيح<textarea required minLength="5" rows="3" value={manualRecord.correction_reason} onChange={event => setManualRecord(old => ({ ...old, correction_reason: event.target.value }))} placeholder="مثال: اعتماد غياب أو تصحيح بصمة"/></label><footer><button type="button" onClick={() => setManualRecord(null)}>إلغاء</button><button className="primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ اليوم الموثق'}</button></footer></form></div>}

      {adjustmentCorrection && <div className="attendance-overlay"><form className="correction-modal" onSubmit={saveAdjustmentCorrection}><header><div><span>إبطال وإنشاء بديل موثق</span><h2>تصحيح تسوية الحضور</h2></div><button type="button" onClick={() => setAdjustmentCorrection(null)} aria-label="إغلاق تصحيح التسوية"><X size={20} /></button></header><div className="policy-grid"><label>نوع التسوية البديلة<select value={adjustmentCorrection.type} onChange={event => setAdjustmentCorrection(old => ({ ...old, type: event.target.value }))}><option value="deduction">خصم من الراتب</option><option value="credit">تخفيض الخصومات</option></select></label><label>المبلغ البديل بالجنيه<input type="number" min="0.01" step="0.01" required value={adjustmentCorrection.amount} onChange={event => setAdjustmentCorrection(old => ({ ...old, amount: event.target.value }))} /></label><label>الدقائق<input type="number" min="0" value={adjustmentCorrection.minutes} onChange={event => setAdjustmentCorrection(old => ({ ...old, minutes: event.target.value }))} /></label></div><label>سبب التسوية البديلة<input required minLength="5" value={adjustmentCorrection.entry_reason} onChange={event => setAdjustmentCorrection(old => ({ ...old, entry_reason: event.target.value }))} /></label><label>سبب التصحيح<textarea required minLength="5" rows="3" value={adjustmentCorrection.correction_reason} onChange={event => setAdjustmentCorrection(old => ({ ...old, correction_reason: event.target.value }))} placeholder="لماذا تم إبطال القيد الأصلي وإنشاء هذا البديل؟" /></label><footer><button type="button" onClick={() => setAdjustmentCorrection(null)}>إلغاء</button><button className="primary" disabled={saving}>{saving ? 'جارٍ التصحيح…' : 'اعتماد التصحيح'}</button></footer></form></div>}

      {correction && <div className="attendance-overlay"><form className="correction-modal" onSubmit={saveCorrection}><header><div><span>تعديل مع سجل تدقيق</span><h2>{correction.work_date}</h2></div><button type="button" onClick={() => setCorrection(null)} aria-label="إغلاق تعديل السجل"><X size={20} /></button></header><label>وقت الدخول<input type="datetime-local" value={toDateTimeLocal(correction.check_in_at)} onChange={(event) => setCorrection((old) => ({ ...old, check_in_at: event.target.value }))} /></label><label>وقت الانصراف<input type="datetime-local" value={toDateTimeLocal(correction.check_out_at)} onChange={(event) => setCorrection((old) => ({ ...old, check_out_at: event.target.value }))} /></label><label>سبب التعديل<textarea required minLength="5" rows="3" value={correction.correction_reason} onChange={(event) => setCorrection((old) => ({ ...old, correction_reason: event.target.value }))} /></label><footer><button type="button" onClick={() => setCorrection(null)}>إلغاء</button><button className="primary" disabled={saving}>حفظ التعديل</button></footer></form></div>}
    </main>
  );
};

export default ERPAttendance;
