import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, ChevronLeft, Clock3, Download, Edit3, Plus, RotateCcw, Settings2, TimerOff, UserRoundCheck, X } from 'lucide-react';
import { dataProvider } from '../dataClient';
import { useData } from '../store/DataContext';
import { attendanceApi } from '../lib/attendanceApi';
import { loadAttendancePage } from '../lib/attendancePageLoad';
import { formatBookingDate, formatDurationMinutes, formatEGP, formatTime12, normalizeTime } from '../lib/businessFormat';
import BusinessDateTimeInput from '../components/BusinessDateTimeInput';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import useModalDialog from '../hooks/useModalDialog';
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
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const lateRawMinutes = item => safeNumber(item?.late_raw_minutes ?? item?.late_minutes);
const lateGrossAmount = item => safeNumber(item?.late_deduction_gross ?? item?.late_cost_gross ?? item?.late_deduction ?? (lateBillableUnits(item) * 10));
const lateWaiverAmount = item => Math.max(0, safeNumber(item?.late_waiver_amount));
const lateNetAmount = item => Math.max(0, safeNumber(item?.late_cost ?? item?.late_deduction ?? (lateGrossAmount(item) - lateWaiverAmount(item))));
const lateDayCount = item => {
  const provided = Number(item?.late_days);
  return Number.isFinite(provided) && provided >= 0 ? provided : (lateRawMinutes(item) > 0 ? 1 : 0);
};
const isLateWaived = item => item?.late_waived === true || Number(item?.late_waived) === 1 || (lateGrossAmount(item) > 0 && lateNetAmount(item) === 0 && lateWaiverAmount(item) > 0);

const previewPayload = () => ({
  summary: { month: currentMonth(), items: [
    { user_id: 3, full_name: 'كريم حسن', role: 'operations', track_attendance: 1, present_days: 18, late_days: 1, late_minutes: 47, late_billable_half_hours: 2, late_billable_minutes: 60, late_deduction_gross: 20, late_waiver_amount: 0, late_deduction: 20, early_leave_minutes: 20, absent_days: 1, monthly_salary: 9000, early_leave_deduction: 58, absence_deduction: 346, manual_adjustment: 100, total_deduction: 524, estimated_net: 8476 },
    { user_id: 4, full_name: 'ليلى عمر', role: 'staff', track_attendance: 1, present_days: 17, late_days: 2, late_minutes: 50, late_billable_half_hours: 3, late_billable_minutes: 90, late_deduction_gross: 30, late_waiver_amount: 10, late_deduction: 20, early_leave_minutes: 0, absent_days: 2, monthly_salary: 7500, early_leave_deduction: 0, absence_deduction: 577, manual_adjustment: 0, total_deduction: 597, estimated_net: 6903 },
  ] },
  policies: [
    { user_id: 3, full_name: 'كريم حسن', role: 'operations', track_attendance: 1, scheduled_start: '12:00:00', scheduled_end: '21:00:00', working_weekdays: '[0,1,2,3,4,6]', grace_minutes: 15, monthly_salary: 9000, expected_working_days: 26, absence_multiplier: 1, late_multiplier: 1, early_leave_deduction_enabled: 1 },
    { user_id: 4, full_name: 'ليلى عمر', role: 'staff', track_attendance: 1, scheduled_start: '12:00:00', scheduled_end: '21:00:00', working_weekdays: '[0,1,2,3,4,6]', grace_minutes: 15, monthly_salary: 7500, expected_working_days: 26, absence_multiplier: 1, late_multiplier: 1, early_leave_deduction_enabled: 0 },
  ],
});

const previewDetails = userId => {
  const day = offset => { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };
  const isLaila = Number(userId) === 4;
  return {
    records: [
      { id: Number(userId) * 100 + 1, user_id: userId, work_date: day(-1), scheduled_start: '12:00:00', scheduled_end: '21:00:00', check_in_at: `${day(-1)} ${isLaila ? '12:31:00' : '12:47:00'}`, check_out_at: `${day(-1)} 21:05:00`, status: 'late', late_minutes: isLaila ? 31 : 47, late_raw_minutes: isLaila ? 31 : 47, late_billable_half_hours: 2, late_billable_minutes: 60, late_cost_gross: 20, late_waiver_amount: 0, late_cost: 20, late_waived: false, early_leave_minutes: 0 },
      ...(isLaila ? [{ id: Number(userId) * 100 + 2, user_id: userId, work_date: day(-2), scheduled_start: '12:00:00', scheduled_end: '21:00:00', check_in_at: `${day(-2)} 12:19:00`, check_out_at: `${day(-2)} 21:00:00`, status: 'late', late_minutes: 19, late_raw_minutes: 19, late_billable_half_hours: 1, late_billable_minutes: 30, late_cost_gross: 10, late_waiver_amount: 10, late_cost: 0, late_waived: true, late_waiver_reason: 'إذن مسبق من الإدارة', early_leave_minutes: 0 }] : [{ id: Number(userId) * 100 + 2, user_id: userId, work_date: day(-2), scheduled_start: '12:00:00', scheduled_end: '21:00:00', check_in_at: `${day(-2)} 12:12:00`, check_out_at: `${day(-2)} 20:40:00`, status: 'early_leave', late_minutes: 0, early_leave_minutes: 20 }]),
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
  const [latenessDecision, setLatenessDecision] = useState(null);
  const [latenessSaving, setLatenessSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeLatenessDecision = useCallback(() => { if (!latenessSaving) setLatenessDecision(null); }, [latenessSaving]);
  const latenessDialogRef = useModalDialog(Boolean(latenessDecision), closeLatenessDecision);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (isPreview) {
      const preview = previewPayload(currentUser); setSummary(preview.summary.items); setPolicies(preview.policies); setToday({ self: { tracked: false } }); setLoading(false); return;
    }
    try {
      const [summaryData, policyData, todayData] = await loadAttendancePage(attendanceApi, month, { isOwner: currentUser?.role === 'owner' });
      setSummary(summaryData.items || []); setPolicies(Array.isArray(policyData) ? policyData : [policyData]); setToday(todayData);
    } catch (requestError) { setError(requestError.message || 'تعذر تحميل بيانات الحضور.'); }
    finally { setLoading(false); }
  }, [currentUser, isPreview, month]);

  useEffect(() => {
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

  const openLatenessDecision = (record, action) => {
    setLatenessDecision({ record, action, reason: '', error: '' });
  };

  const saveLatenessDecision = async (event) => {
    event.preventDefault();
    const reason = String(latenessDecision?.reason || '').trim();
    if (reason.length < 5) {
      setLatenessDecision(current => ({ ...current, error: 'اكتب سببًا واضحًا من 5 أحرف على الأقل.' }));
      return;
    }

    const { action, record } = latenessDecision;
    setLatenessSaving(true);
    setLatenessDecision(current => ({ ...current, error: '' }));
    try {
      if (isPreview) {
        const gross = lateGrossAmount(record);
        const currentWaiver = lateWaiverAmount(record);
        const nextWaiver = action === 'waive' ? gross : 0;
        const waiverDelta = nextWaiver - currentWaiver;
        const nextRecord = {
          ...record,
          late_waived: action === 'waive',
          late_waiver_amount: nextWaiver,
          late_cost: Math.max(0, gross - nextWaiver),
          late_waiver_reason: reason,
        };
        setDetails(current => ({ ...current, records: current.records.map(item => Number(item.id) === Number(record.id) ? nextRecord : item) }));
        const updateEmployee = employee => {
          if (String(employee.user_id) !== String(selected.user_id)) return employee;
          const previousNet = lateNetAmount(employee);
          const nextSummaryWaiver = Math.max(0, lateWaiverAmount(employee) + waiverDelta);
          const nextNet = Math.max(0, lateGrossAmount(employee) - nextSummaryWaiver);
          const deductionDelta = nextNet - previousNet;
          return {
            ...employee,
            late_waiver_amount: nextSummaryWaiver,
            late_deduction: nextNet,
            total_deduction: safeNumber(employee.total_deduction) + deductionDelta,
            estimated_net: safeNumber(employee.estimated_net) - deductionDelta,
          };
        };
        setSummary(current => current.map(updateEmployee));
        setSelected(current => current ? updateEmployee(current) : current);
      } else {
        await attendanceApi.setLateness(record.id, { action, reason });
        const [summaryData, detailsData] = await Promise.all([
          attendanceApi.summary(month),
          attendanceApi.records(month, selected.user_id),
        ]);
        const nextSummary = summaryData.items || [];
        setSummary(nextSummary);
        setSelected(nextSummary.find(item => String(item.user_id) === String(selected.user_id)) || selected);
        setDetails({ loading: false, records: detailsData.records || [], adjustments: detailsData.adjustments || [] });
      }
      setLatenessDecision(null);
    } catch (requestError) {
      setLatenessDecision(current => ({ ...current, error: requestError.message || 'تعذر تحديث خصم التأخير. حاول مرة أخرى.' }));
    } finally {
      setLatenessSaving(false);
    }
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
    tracked: acc.tracked + (item.track_attendance ? 1 : 0),
    lateDays: acc.lateDays + lateDayCount(item),
    lateMinutes: acc.lateMinutes + lateRawMinutes(item),
    lateGross: acc.lateGross + lateGrossAmount(item),
    lateWaived: acc.lateWaived + lateWaiverAmount(item),
    lateNet: acc.lateNet + lateNetAmount(item),
  }), { tracked: 0, lateDays: 0, lateMinutes: 0, lateGross: 0, lateWaived: 0, lateNet: 0 }), [summary]);
  const filtered = summary.filter((item) => statusFilter === 'all'
    || (statusFilter === 'late' && lateNetAmount(item) > 0)
    || (statusFilter === 'waived' && lateWaiverAmount(item) > 0)
    || (statusFilter === 'absent' && Number(item.absent_days) > 0));
  const lateRecords = useMemo(() => details.records.filter(record => lateRawMinutes(record) > 0 || lateGrossAmount(record) > 0), [details.records]);
  const payrollAdjustments = useMemo(() => details.adjustments.filter(item => !['late_waiver', 'late_waiver_reversal'].includes(item.adjustment_type)), [details.adjustments]);
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

      <section className="attendance-strip attendance-money-strip" aria-label="ملخص خصومات التأخير للشهر">
        <div className="attendance-money-card attendance-money-card--gross"><span>خصم التأخير قبل الإعفاء</span><strong>{loading ? '—' : money(totals.lateGross)}</strong><small><Clock3 size={14} /> المبلغ الأصلي لكل أيام التأخير</small></div>
        <div className="attendance-money-card attendance-money-card--waived"><span>إعفاءات اعتمدها المالك</span><strong>{loading ? '—' : money(totals.lateWaived)}</strong><small><Check size={14} /> مبالغ أزيلت مع بقاء سجل الحضور</small></div>
        <div className="attendance-money-card attendance-money-card--net"><span>صافي خصم التأخير</span><strong>{loading ? '—' : money(totals.lateNet)}</strong><small>الأصلي − الإعفاء = الخصم الفعلي</small></div>
        <div className="attendance-money-card attendance-money-card--days"><span>أيام التأخير</span><strong>{loading ? '—' : totals.lateDays}</strong><small>{formatDurationMinutes(totals.lateMinutes, { compact: true })} تأخير فعلي · {totals.tracked} موظفين</small></div>
      </section>

      <section className="attendance-workspace">
        <div className="attendance-workspace-heading"><div><span>كشف الشهر</span><h2>تأخيرات الموظفين وخصوماتها</h2><p>اختر موظفًا لمراجعة كل يوم وإدارة الإعفاءات الموثقة.</p></div><strong>{filtered.length}<small>موظف</small></strong></div>
        <div className="attendance-toolbar"><div className="attendance-filters" role="group" aria-label="تصفية الموظفين">{[['all', 'الكل'], ['late', 'خصم فعال'], ['waived', 'به إعفاء'], ['absent', 'لديه غياب']].map(([value, label]) => <button type="button" key={value} className={statusFilter === value ? 'active' : ''} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</button>)}</div><button className="attendance-export" type="button" onClick={() => window.print()}><Download size={15} /> طباعة التقرير</button></div>
        {loading ? <div className="attendance-loading">جارٍ تجهيز تقرير الشهر…</div> : filtered.length === 0 ? <div className="attendance-empty"><CalendarClock size={34} /><h2>لا توجد نتائج</h2><p>غيّر الفلتر أو اختر شهرًا آخر.</p></div> : (
          <>
            <div className="attendance-table-wrap"><table className="attendance-table attendance-lateness-table"><thead><tr><th>الموظف</th><th>أيام التأخير</th><th>التأخير الفعلي</th><th>الخصم الأصلي</th><th>الإعفاء</th><th>صافي خصم التأخير</th><th>إجمالي خصومات الراتب</th><th><span className="sr-only">إجراءات</span></th></tr></thead><tbody>{filtered.map((employee) => <tr key={employee.user_id}><td><strong>{employee.full_name}</strong><small>{roleLabels[employee.role] || employee.role}</small></td><td><strong>{lateDayCount(employee)} يوم</strong><small>{employee.track_attendance ? 'الحضور مفعّل' : 'الحضور معفي'}</small></td><td className={lateRawMinutes(employee) ? 'warn' : ''}><strong>{formatDurationMinutes(lateRawMinutes(employee), { compact: true })}</strong><small>{formatDurationMinutes(lateBillableMinutes(employee), { compact: true })} محتسبة</small></td><td className="lateness-gross"><strong>{money(lateGrossAmount(employee))}</strong><small>قبل الإعفاء</small></td><td className="lateness-waived"><strong>− {money(lateWaiverAmount(employee))}</strong><small>{lateWaiverAmount(employee) ? 'موثق بقرار المالك' : 'لا يوجد'}</small></td><td className={lateNetAmount(employee) ? 'lateness-net danger' : 'lateness-net is-clear'}><strong>{money(lateNetAmount(employee))}</strong><small>{lateNetAmount(employee) ? 'خصم فعال' : 'بدون خصم تأخير'}</small></td><td><strong>{money(employee.total_deduction)}</strong><small>كل الخصومات</small></td><td><div className="row-actions">{isOwner && <button type="button" title="إعداد السياسة" aria-label={`إعداد سياسة ${employee.full_name}`} onClick={() => startPolicyEdit(employee)}><Settings2 size={16} /></button>}<button type="button" className="row-actions__details" title="فتح سجل التأخيرات" aria-label={`فتح سجل تأخيرات ${employee.full_name}`} onClick={() => openDetails(employee)}><span>التفاصيل</span><ChevronLeft size={17} /></button></div></td></tr>)}</tbody></table></div>
            <div className="attendance-mobile-list">{filtered.map((employee) => <article key={employee.user_id} className="attendance-employee-card attendance-lateness-card"><header><div><strong>{employee.full_name}</strong><small>{roleLabels[employee.role] || employee.role}</small></div><span className={lateNetAmount(employee) ? 'status status--late' : 'status status--present'}>{lateNetAmount(employee) ? 'خصم فعال' : 'بدون خصم'}</span></header><dl><div><dt>أيام التأخير</dt><dd>{lateDayCount(employee)} يوم</dd></div><div><dt>التأخير الفعلي</dt><dd className={lateRawMinutes(employee) ? 'warn' : ''}>{formatDurationMinutes(lateRawMinutes(employee), { compact: true })}<small>{formatDurationMinutes(lateBillableMinutes(employee), { compact: true })} محتسبة</small></dd></div><div><dt>الخصم الأصلي</dt><dd>{money(lateGrossAmount(employee))}</dd></div><div><dt>الإعفاء</dt><dd className="waived">− {money(lateWaiverAmount(employee))}</dd></div><div className="attendance-lateness-card__net"><dt>صافي خصم التأخير</dt><dd className={lateNetAmount(employee) ? 'danger' : 'waived'}>{money(lateNetAmount(employee))}</dd></div></dl><footer>{isOwner && <button type="button" aria-label={`إعداد سياسة ${employee.full_name}`} onClick={() => startPolicyEdit(employee)}><Settings2 size={15} /> إعداد السياسة</button>}<button type="button" aria-label={`فتح سجل تأخيرات ${employee.full_name}`} onClick={() => openDetails(employee)}><CalendarClock size={15} /> سجل التأخيرات</button></footer></article>)}</div>
          </>
        )}
      </section>

      <EmployeeFinanceAccounts month={month} canManage={canManageEmployeeFinance} />

      {selected && <div className="attendance-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
        <aside className="attendance-drawer" role="dialog" aria-modal={latenessDecision ? undefined : 'true'} aria-hidden={latenessDecision ? 'true' : undefined} aria-label={`تفاصيل حضور ${selected.full_name}`}>
          <header><div><span>سجل التأخيرات · {month}</span><h2>{selected.full_name}</h2><p>{roleLabels[selected.role]} · صافي خصم التأخير {money(lateNetAmount(selected))}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="إغلاق سجل التأخيرات"><X size={20} /></button></header>
          <div className="drawer-breakdown drawer-lateness-breakdown"><div><span>أيام التأخير</span><strong>{lateDayCount(selected)} يوم</strong><small>{formatDurationMinutes(lateRawMinutes(selected), { compact: true })} فعلي</small></div><div className="drawer-breakdown__gross"><span>الخصم الأصلي</span><strong>{money(lateGrossAmount(selected))}</strong><small>قبل أي إعفاء</small></div><div className="drawer-breakdown__waived"><span>إعفاءات المالك</span><strong>− {money(lateWaiverAmount(selected))}</strong><small>قرارات موثقة</small></div><div className="drawer-breakdown__net"><span>صافي خصم التأخير</span><strong>{money(lateNetAmount(selected))}</strong><small>المبلغ الفعلي</small></div></div>
          <section className="drawer-section lateness-ledger-section">
            <div className="attendance-section-heading attendance-section-heading--ledger"><div><span>تفصيل يوم بيوم</span><h3>سجل التأخيرات اليومي</h3></div><strong>{lateRecords.length}<small> يوم</small></strong></div>
            {details.loading ? <p className="drawer-note">جارٍ تحميل سجل التأخيرات…</p> : details.error ? <p className="drawer-note drawer-note--error">{details.error}</p> : lateRecords.length === 0 ? <div className="lateness-empty"><Check size={26} /><strong>لا توجد أيام تأخير في هذا الشهر</strong><p>سيظهر هنا كل يوم تأخير ومدته وتكلفته عند تسجيله.</p></div> : <div className="lateness-ledger">{lateRecords.map((record) => {
              const waived = isLateWaived(record);
              const gross = lateGrossAmount(record);
              const waiver = lateWaiverAmount(record);
              const net = lateNetAmount(record);
              return <article key={record.id} className={waived ? 'lateness-ledger-row is-waived' : 'lateness-ledger-row'}>
                <header><div><time dateTime={record.work_date}>{formatBookingDate(record.work_date)}</time><small>{record.work_date}</small></div><span className={waived ? 'status status--waived' : 'status status--late'}>{waived ? <><Check size={13} /> تم الإعفاء</> : 'خصم فعال'}</span></header>
                <dl className="lateness-ledger-times"><div><dt>موعد الحضور</dt><dd>{formatTime12(record.scheduled_start || '12:00')}</dd></div><div><dt>الحضور الفعلي</dt><dd>{formatTime12(record.check_in_at)}</dd></div><div><dt>التأخير الفعلي</dt><dd>{formatDurationMinutes(lateRawMinutes(record), { compact: true })}</dd></div><div><dt>التأخير المحتسب</dt><dd>{formatDurationMinutes(lateBillableMinutes(record), { compact: true })}</dd></div></dl>
                <div className="lateness-money-flow" aria-label={`الخصم الأصلي ${money(gross)} ناقص الإعفاء ${money(waiver)} يساوي ${money(net)}`}><span className="lateness-money-flow__gross"><small>الخصم الأصلي</small><strong>{money(gross)}</strong></span><b aria-hidden="true">−</b><span className="lateness-money-flow__waiver"><small>الإعفاء</small><strong>{money(waiver)}</strong></span><b aria-hidden="true">=</b><span className="lateness-money-flow__net"><small>الصافي</small><strong>{money(net)}</strong></span></div>
                <footer><div>{waived && <small><Check size={13} /> أُزيلت تكلفة اليوم مع الاحتفاظ بوقت الحضور الفعلي.</small>}{record.late_waiver_reason && <span>السبب: {record.late_waiver_reason}</span>}</div>{isOwner && <button type="button" className={waived ? 'lateness-action lateness-action--restore' : 'lateness-action lateness-action--waive'} onClick={() => openLatenessDecision(record, waived ? 'restore' : 'waive')}>{waived ? <><RotateCcw size={15} /> استرجاع الخصم</> : <><Check size={15} /> إعفاء اليوم</>}</button>}</footer>
              </article>;
            })}</div>}
          </section>
          <section className="drawer-section drawer-section--secondary"><div className="attendance-section-heading"><div><span>للمراجعة والتصحيح</span><h3>السجل الكامل للحضور</h3></div>{isOwner && <button type="button" onClick={openManualRecord}><Plus size={15}/> إضافة حضور أو غياب</button>}</div>{details.loading ? <p className="drawer-note">جارٍ التحميل…</p> : details.records.length === 0 ? <p className="drawer-note">لا توجد أيام مسجلة في هذا الشهر.</p> : <div className="daily-records">{details.records.map((record) => <div key={record.id}><time>{record.work_date}</time><span className={`status status--${record.status}`}>{statusLabels[record.status] || record.status}{record.correction_reason ? ' · معدل يدويًا' : ''}</span><bdi>{record.check_in_at ? formatTime12(record.check_in_at) : '—'} → {record.check_out_at ? formatTime12(record.check_out_at) : ['absent','authorized_leave'].includes(record.status) ? 'بدون حضور' : 'سجل مفتوح'}</bdi>{isOwner && <button type="button" onClick={() => setCorrection({ ...record, check_in_at: record.check_in_at?.slice(0, 16) || '', check_out_at: record.check_out_at?.slice(0, 16) || '', correction_reason: '' })}><Edit3 size={14} /> تعديل</button>}</div>)}</div>}</section>
          <section className="drawer-section drawer-section--secondary"><h3>سجل التسويات المالية الأخرى</h3>{payrollAdjustments.length === 0 ? <p className="drawer-note">لا توجد تسويات أخرى لهذا الشهر.</p> : <div className="attendance-adjustments">{payrollAdjustments.map(item => <article key={item.id} className={item.voided_at ? 'is-voided' : ''}><div><strong className={item.adjustment_type === 'credit' || Number(item.amount) < 0 ? 'adjustment-credit' : 'adjustment-deduction'}>{item.adjustment_type === 'credit' || Number(item.amount) < 0 ? 'تخفيض الخصومات' : 'خصم من الراتب'} · {money(Math.abs(Number(item.amount)))}</strong><span>{item.reason}</span><small>{String(item.created_at || '').slice(0, 16).replace('T', ' ')}{item.voided_at ? ` · مُبطلة: ${item.void_reason || 'تصحيح موثق'}` : ''}</small></div>{isOwner && !item.voided_at && <button type="button" onClick={() => setAdjustmentCorrection({ ...item, type: item.adjustment_type === 'credit' || Number(item.amount) < 0 ? 'credit' : 'deduction', amount: Math.abs(Number(item.amount)), minutes: item.minutes || 0, entry_reason: item.reason || '', correction_reason: '' })}><Edit3 size={14} /> تصحيح</button>}</article>)}</div>}</section>
          {isOwner && <section className="drawer-section"><h3>إضافة تسوية مالية</h3><form className="adjustment-form" onSubmit={saveAdjustment}><fieldset className="adjustment-kind"><legend>نوع التسوية</legend><label className="adjustment-kind__deduction"><input type="radio" name="adjustment-type" value="deduction" checked={adjustment.type === 'deduction'} onChange={(event) => setAdjustment((old) => ({ ...old, type: event.target.value }))} /><span>خصم من الراتب</span></label><label className="adjustment-kind__credit"><input type="radio" name="adjustment-type" value="credit" checked={adjustment.type === 'credit'} onChange={(event) => setAdjustment((old) => ({ ...old, type: event.target.value }))} /><span>تخفيض الخصومات</span></label></fieldset><label>المبلغ بالجنيه<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={adjustment.amount} onChange={(event) => setAdjustment((old) => ({ ...old, amount: event.target.value }))} placeholder="0.00" /></label><label>شهر التسوية<input type="month" value={month} readOnly aria-readonly="true" /></label><label className="adjustment-reason">السبب<input required minLength="5" value={adjustment.reason} onChange={(event) => setAdjustment((old) => ({ ...old, reason: event.target.value }))} placeholder="مثال: إذن معتمد من الإدارة" /></label><button className={adjustment.type === 'credit' ? 'adjustment-save adjustment-save--credit' : 'adjustment-save'} disabled={saving}>{saving ? 'جارٍ الحفظ…' : adjustment.type === 'credit' ? 'حفظ تخفيض الخصومات' : 'حفظ الخصم'}</button></form></section>}
        </aside>
      </div>}

      {latenessDecision && <div className="attendance-overlay attendance-overlay--decision">
        <form ref={latenessDialogRef} className="correction-modal lateness-decision-modal" role="dialog" aria-modal="true" aria-labelledby="lateness-decision-title" onSubmit={saveLatenessDecision}>
          <header><div><span>قرار موثق بصلاحية المالك</span><h2 id="lateness-decision-title">{latenessDecision.action === 'waive' ? 'إعفاء يوم من خصم التأخير' : 'استرجاع خصم التأخير'}</h2></div><button type="button" onClick={closeLatenessDecision} aria-label="إغلاق نافذة قرار التأخير"><X size={20} /></button></header>
          <div className="lateness-decision-summary"><div><span>الموظف</span><strong>{selected?.full_name}</strong></div><div><span>اليوم</span><strong>{formatBookingDate(latenessDecision.record.work_date)}</strong></div><div><span>التأخير</span><strong>{formatDurationMinutes(lateRawMinutes(latenessDecision.record), { compact: true })}</strong></div><div><span>{latenessDecision.action === 'waive' ? 'المبلغ الذي سيُعفى' : 'المبلغ الذي سيعود'}</span><strong>{money(lateGrossAmount(latenessDecision.record))}</strong></div></div>
          <p className="lateness-decision-note">وقت الحضور الفعلي سيظل محفوظًا في السجل. هذا القرار يغيّر تكلفة التأخير لهذا اليوم فقط.</p>
          <label>سبب القرار<textarea data-dialog-initial required minLength="5" rows="3" value={latenessDecision.reason} onChange={(event) => setLatenessDecision(current => ({ ...current, reason: event.target.value, error: '' }))} placeholder={latenessDecision.action === 'waive' ? 'مثال: إذن مسبق من الإدارة' : 'مثال: إلغاء الإذن بعد المراجعة'} /></label>
          {latenessDecision.error && <p className="lateness-decision-error" role="alert"><AlertTriangle size={15} />{latenessDecision.error}</p>}
          <footer><button type="button" onClick={closeLatenessDecision} disabled={latenessSaving}>إلغاء</button><button className={latenessDecision.action === 'waive' ? 'primary lateness-confirm--waive' : 'primary lateness-confirm--restore'} disabled={latenessSaving}>{latenessSaving ? 'جارٍ الحفظ…' : latenessDecision.action === 'waive' ? 'اعتماد الإعفاء' : 'استرجاع الخصم'}</button></footer>
        </form>
      </div>}

      {editingPolicy && <div className="attendance-overlay" role="presentation"><form className="policy-modal" role="dialog" aria-modal="true" onSubmit={savePolicy}><header><div><span>سياسة الموظف</span><h2>{editingPolicy.full_name}</h2></div><button type="button" onClick={() => setEditingPolicy(null)} aria-label="إغلاق"><X size={20} /></button></header><div className="policy-fixed-rules" aria-label="قواعد حضور ثابتة"><div><UserRoundCheck size={17} /><span>تسجيل الحضور</span><strong>مفعّل لكل الموظفين</strong></div><div><Clock3 size={17} /><span>بداية الدوام</span><strong>12:00 ظهرًا</strong></div><div><CalendarClock size={17} /><span>فترة السماح</span><strong>15 دقيقة</strong></div></div><p className="policy-fixed-note">قواعد ثابتة: بعد السماح يُحسب كل نصف ساعة بدأت بقيمة 10 ج.م.</p><div className="policy-grid"><label>نهاية الدوام<BusinessTimeSelect min="13:00" max="24:00" required value={editingPolicy.scheduled_end} onChange={(event) => setEditingPolicy((old) => ({ ...old, scheduled_end: event.target.value }))} /></label><label>الراتب الشهري<input type="number" min="0" step="0.01" value={editingPolicy.monthly_salary} onChange={(event) => setEditingPolicy((old) => ({ ...old, monthly_salary: Number(event.target.value) }))} /></label><label>أيام العمل المتوقعة<input type="number" min="1" max="31" value={editingPolicy.expected_working_days} onChange={(event) => setEditingPolicy((old) => ({ ...old, expected_working_days: Number(event.target.value) }))} /></label><label>معامل الغياب<input type="number" min="0" step="0.25" value={editingPolicy.absence_multiplier} onChange={(event) => setEditingPolicy((old) => ({ ...old, absence_multiplier: Number(event.target.value) }))} /></label><label className="policy-checkbox"><input type="checkbox" checked={editingPolicy.early_leave_deduction_enabled} onChange={(event) => setEditingPolicy((old) => ({ ...old, early_leave_deduction_enabled: event.target.checked }))} /> خصم الانصراف المبكر</label></div><fieldset><legend>أيام العمل</legend><div className="weekday-picker">{weekDays.map((day) => <label key={day.id}><input type="checkbox" checked={editingPolicy.working_weekdays.includes(day.id)} onChange={(event) => setEditingPolicy((old) => ({ ...old, working_weekdays: event.target.checked ? [...old.working_weekdays, day.id].sort() : old.working_weekdays.filter((value) => value !== day.id) }))} /><span>{day.label}</span></label>)}</div></fieldset><footer><button type="button" onClick={() => setEditingPolicy(null)}>إلغاء</button><button className="primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ السياسة'}</button></footer></form></div>}

      {manualRecord && <div className="attendance-overlay"><form className="correction-modal" onSubmit={saveManualRecord}><header><div><span>صلاحية المالك · سجل موثق</span><h2>إضافة حضور أو غياب</h2></div><button type="button" onClick={() => setManualRecord(null)} aria-label="إغلاق إضافة يوم الحضور"><X size={20}/></button></header><div className="policy-grid"><label>اليوم<input type="date" required value={manualRecord.work_date} onChange={event => { const date = event.target.value; setManualRecord(old => ({ ...old, work_date: date, check_in_at: old.check_in_at ? `${date}T${old.check_in_at.slice(11, 16)}` : '', check_out_at: old.check_out_at ? `${date}T${old.check_out_at.slice(11, 16)}` : '' })); }}/></label><label>الحالة<select value={manualRecord.status} onChange={event => setManualRecord(old => ({ ...old, status: event.target.value }))}>{['present','late','early_leave','absent','authorized_leave'].map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label></div>{!['absent','authorized_leave'].includes(manualRecord.status) && <div className="policy-grid"><label>وقت الدخول<BusinessDateTimeInput required value={manualRecord.check_in_at} onChange={event => setManualRecord(old => ({ ...old, check_in_at: event.target.value }))}/></label><label>وقت الانصراف<BusinessDateTimeInput required value={manualRecord.check_out_at} onChange={event => setManualRecord(old => ({ ...old, check_out_at: event.target.value }))}/></label></div>}<label>ملاحظات<input value={manualRecord.notes} onChange={event => setManualRecord(old => ({ ...old, notes: event.target.value }))} placeholder="اختياري"/></label><label>سبب التسجيل أو التصحيح<textarea required minLength="5" rows="3" value={manualRecord.correction_reason} onChange={event => setManualRecord(old => ({ ...old, correction_reason: event.target.value }))} placeholder="مثال: اعتماد غياب أو تصحيح بصمة"/></label><footer><button type="button" onClick={() => setManualRecord(null)}>إلغاء</button><button className="primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ اليوم الموثق'}</button></footer></form></div>}

      {adjustmentCorrection && <div className="attendance-overlay"><form className="correction-modal" onSubmit={saveAdjustmentCorrection}><header><div><span>إبطال وإنشاء بديل موثق</span><h2>تصحيح تسوية الحضور</h2></div><button type="button" onClick={() => setAdjustmentCorrection(null)} aria-label="إغلاق تصحيح التسوية"><X size={20} /></button></header><div className="policy-grid"><label>نوع التسوية البديلة<select value={adjustmentCorrection.type} onChange={event => setAdjustmentCorrection(old => ({ ...old, type: event.target.value }))}><option value="deduction">خصم من الراتب</option><option value="credit">تخفيض الخصومات</option></select></label><label>المبلغ البديل بالجنيه<input type="number" min="0.01" step="0.01" required value={adjustmentCorrection.amount} onChange={event => setAdjustmentCorrection(old => ({ ...old, amount: event.target.value }))} /></label><label>الدقائق<input type="number" min="0" value={adjustmentCorrection.minutes} onChange={event => setAdjustmentCorrection(old => ({ ...old, minutes: event.target.value }))} /></label></div><label>سبب التسوية البديلة<input required minLength="5" value={adjustmentCorrection.entry_reason} onChange={event => setAdjustmentCorrection(old => ({ ...old, entry_reason: event.target.value }))} /></label><label>سبب التصحيح<textarea required minLength="5" rows="3" value={adjustmentCorrection.correction_reason} onChange={event => setAdjustmentCorrection(old => ({ ...old, correction_reason: event.target.value }))} placeholder="لماذا تم إبطال القيد الأصلي وإنشاء هذا البديل؟" /></label><footer><button type="button" onClick={() => setAdjustmentCorrection(null)}>إلغاء</button><button className="primary" disabled={saving}>{saving ? 'جارٍ التصحيح…' : 'اعتماد التصحيح'}</button></footer></form></div>}

      {correction && <div className="attendance-overlay"><form className="correction-modal" onSubmit={saveCorrection}><header><div><span>تعديل مع سجل تدقيق</span><h2>{correction.work_date}</h2></div><button type="button" onClick={() => setCorrection(null)} aria-label="إغلاق تعديل السجل"><X size={20} /></button></header><label>وقت الدخول<BusinessDateTimeInput value={toDateTimeLocal(correction.check_in_at)} onChange={(event) => setCorrection((old) => ({ ...old, check_in_at: event.target.value }))} /></label><label>وقت الانصراف<BusinessDateTimeInput value={toDateTimeLocal(correction.check_out_at)} onChange={(event) => setCorrection((old) => ({ ...old, check_out_at: event.target.value }))} /></label><label>سبب التعديل<textarea required minLength="5" rows="3" value={correction.correction_reason} onChange={(event) => setCorrection((old) => ({ ...old, correction_reason: event.target.value }))} /></label><footer><button type="button" onClick={() => setCorrection(null)}>إلغاء</button><button className="primary" disabled={saving}>حفظ التعديل</button></footer></form></div>}
    </main>
  );
};

export default ERPAttendance;
