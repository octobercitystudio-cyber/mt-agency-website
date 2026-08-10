import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, CheckCircle2, Clock3,
  HandHeart, PackagePlus, ReceiptText, Save, Square, WalletCards, X,
} from 'lucide-react';
import { formatBookingDate, formatTime12 } from '../lib/businessFormat';
import useModalDialog from '../hooks/useModalDialog';
import {
  durationInputToMinutes, durationLabel, elapsedSessionSeconds, roundedElapsedMinutes,
} from './studioSessionDuration';
import { completeStudioSession } from './studioSessionComplete';
import {
  createSettlementIdempotencyKey, moneyLabel, previewStudioSessionSettlement,
} from './studioSessionSettlement';
import './ERPStopSessionDialog.css';

const emptyNewPackage = session => ({
  service_id: String(session.service_id || ''),
  name: `${session.package_name || 'باقة استديو'} — استكمال`,
  purchased_minutes: '60', validity_days: '90', total_price: '0', initial_paid: '0', notes: '',
});

const emptyCustom = { description: 'وقت تصوير إضافي', hourly_rate: '', amount: '', project_name: 'خدمة وقت تصوير إضافي' };

function minutesFromInputs(hours, minutes) {
  try { return durationInputToMinutes(hours, minutes); } catch { return 0; }
}

function CoverageBar({ preview, destinationLabel, destinationTone = 'excess' }) {
  const actual = Math.max(1, Number(preview?.actual_minutes || 0));
  const covered = Math.min(100, (Number(preview?.covered_minutes || 0) / actual) * 100);
  const excess = Math.max(0, 100 - covered);
  return <section className="session-coverage" aria-label="توزيع وقت جلسة التصوير">
    <div className="session-coverage__labels"><span><i className="covered" /> مغطى من الباقة</span><span><i className={destinationTone} /> {destinationLabel || 'وقت يحتاج تسوية'}</span></div>
    <div className="session-coverage__bar" role="img" aria-label={`${durationLabel(preview?.covered_minutes)} مغطى و${durationLabel(preview?.excess_minutes)} زائد`}>
      <span className="session-coverage__covered" style={{ width: `${covered}%` }} />
      {excess > 0 && <span className={`session-coverage__excess session-coverage__excess--${destinationTone}`} style={{ width: `${excess}%` }} />}
    </div>
    <div className="session-coverage__values"><strong>{durationLabel(preview?.covered_minutes)}</strong><strong>{durationLabel(preview?.excess_minutes)}</strong></div>
  </section>;
}

function SummaryCards({ preview }) {
  return <div className="session-stop-summary" aria-live="polite">
    <div><span>الوقت الفعلي</span><strong>{durationLabel(preview.actual_minutes)}</strong></div>
    <div className="covered"><span>المغطى من الباقة الحالية</span><strong>{durationLabel(preview.covered_minutes)}</strong></div>
    <div className={preview.excess_minutes ? 'excess' : 'covered'}><span>الوقت الزائد</span><strong>{durationLabel(preview.excess_minutes)}</strong></div>
  </div>;
}

function SettlementChoice({ value, selected, onChange, icon: Icon, title, description, disabled = false }) {
  return <label className={`session-settlement-choice${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
    <input type="radio" name="settlement-family" value={value} checked={selected} onChange={() => onChange(value)} disabled={disabled} />
    <span className="session-settlement-choice__icon"><Icon /></span>
    <span><strong>{title}</strong><small>{description}</small></span>
    <CheckCircle2 className="session-settlement-choice__check" />
  </label>;
}

function StopSessionDialogContent({ session, role = 'owner', serverOffset, returnFocusRef, onClose, onCompleted }) {
  const [initialElapsed] = useState(() => roundedElapsedMinutes(elapsedSessionSeconds(session, Date.now(), serverOffset)));
  const [hours, setHours] = useState(() => String(Math.floor(initialElapsed / 60)));
  const [minutes, setMinutes] = useState(() => String(initialElapsed % 60));
  const [actualReels, setActualReels] = useState('');
  const [reason, setReason] = useState('');
  const [liveElapsedMinutes, setLiveElapsedMinutes] = useState(initialElapsed);
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [family, setFamily] = useState('');
  const [otherMode, setOtherMode] = useState('');
  const [existingPackageId, setExistingPackageId] = useState('');
  const [newPackage, setNewPackage] = useState(() => emptyNewPackage(session));
  const [custom, setCustom] = useState(emptyCustom);
  const [waiverReason, setWaiverReason] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => createSettlementIdempotencyKey(session));
  const close = () => { if (!busy) onClose(); };
  const dialogRef = useModalDialog(true, close, { returnFocusRef });
  const inputMinutes = useMemo(() => minutesFromInputs(hours, minutes), [hours, minutes]);
  const hasExcess = Number(preview?.excess_minutes || 0) > 0;
  const isOwner = role === 'owner';
  const isOperations = role === 'operations';

  useEffect(() => {
    const timer = window.setInterval(() => setLiveElapsedMinutes(roundedElapsedMinutes(elapsedSessionSeconds(session, Date.now(), serverOffset))), 1000);
    return () => window.clearInterval(timer);
  }, [session, serverOffset]);

  useEffect(() => {
    if (!inputMinutes || session.billing_unit === 'reel') return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setPreviewBusy(true); setError('');
      try {
        const result = await previewStudioSessionSettlement(session, inputMinutes);
        if (!active) return;
        setPreview(result);
        const suggested = result.default_mode || (result.eligible_packages?.length ? 'existing_package' : result.overage_rate ? 'package_overage' : 'custom_invoice');
        if (result.excess_minutes > 0) setFamily(current => current || (suggested === 'new_package' ? 'new_package' : 'other'));
        if (suggested !== 'new_package') setOtherMode(current => current || suggested);
        if (result.eligible_packages?.[0]) setExistingPackageId(current => current || String(result.eligible_packages[0].id));
        setNewPackage(current => ({ ...current, purchased_minutes: String(Math.max(60, result.excess_minutes || 0)), service_id: current.service_id || String(result.package_templates?.[0]?.id || '') }));
      } catch (requestError) {
        if (active) { setPreview(null); setError(requestError?.message || 'تعذر حساب الرصيد المتاح الآن.'); }
      } finally { if (active) setPreviewBusy(false); }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [inputMinutes, session]);

  const destinationLabel = family === 'waive' ? 'وقت تم التغاضي عنه'
    : family === 'new_package' ? 'مخصص لباقة جديدة'
      : otherMode === 'existing_package' ? 'منقول لباقة أخرى'
        : 'وقت إضافي مستحق';
  const destinationTone = family === 'waive' ? 'waive' : family === 'new_package' || otherMode === 'existing_package' ? 'transfer' : 'excess';

  const validateDuration = () => {
    const totalMinutes = durationInputToMinutes(hours, minutes);
    if (session.billing_unit === 'reel') {
      const reels = Number(actualReels);
      if (!/^\d+$/.test(String(actualReels).trim()) || !Number.isSafeInteger(reels) || reels <= 0) throw new Error('أدخل عدد الريلز التي تم تصويرها كرقم صحيح أكبر من صفر.');
    }
    return totalMinutes;
  };

  const selectedSettlement = () => {
    if (!hasExcess) return null;
    if (family === 'new_package') return { mode: 'new_package', ...newPackage, purchased_minutes: Number(newPackage.purchased_minutes), validity_days: Number(newPackage.validity_days), total_price: newPackage.total_price, initial_paid: newPackage.initial_paid };
    if (family === 'waive') return { mode: 'waive', internal_reason: waiverReason.trim(), client_note: clientNote.trim() };
    if (otherMode === 'existing_package') return { mode: 'existing_package', target_package_id: Number(existingPackageId) };
    if (otherMode === 'package_overage') return { mode: 'package_overage', hourly_rate: custom.hourly_rate || preview?.overage_rate };
    if (otherMode === 'custom_project') return { mode: 'custom_project', name: custom.project_name.trim(), description: custom.description.trim(), amount: custom.amount };
    return { mode: 'custom_invoice', description: custom.description.trim(), hourly_rate: custom.hourly_rate, amount: custom.amount };
  };

  const validateSettlement = settlement => {
    if (!hasExcess) return;
    if (isOperations) throw new Error('صلاحية التشغيل لا تسمح باعتماد الوقت الزائد. أرسل التسوية للمالك واترك الجلسة جارية.');
    if (!settlement) throw new Error('اختر طريقة تسوية الوقت الزائد.');
    if (settlement.mode === 'new_package') {
      if (!settlement.service_id || !settlement.name.trim()) throw new Error('اختر نموذج الباقة واكتب اسم الباقة الجديدة.');
      if (!Number.isSafeInteger(settlement.purchased_minutes) || settlement.purchased_minutes < preview.excess_minutes) throw new Error('رصيد الباقة الجديدة يجب أن يغطي الوقت الزائد كاملًا.');
      if (Number(settlement.initial_paid) < 0 || Number(settlement.total_price) < Number(settlement.initial_paid)) throw new Error('سعر الباقة أو المدفوع المبدئي غير صحيح.');
    }
    if (settlement.mode === 'existing_package' && !settlement.target_package_id) throw new Error('اختر الباقة الأخرى التي ستتحمل الوقت الزائد.');
    if (settlement.mode === 'package_overage' && Number(settlement.hourly_rate) <= 0) throw new Error('لا يوجد سعر ساعة إضافية صالح.');
    if (settlement.mode === 'custom_invoice' && Number(settlement.amount || 0) <= 0 && Number(settlement.hourly_rate || 0) <= 0) throw new Error('أدخل مبلغ الفاتورة أو سعر الساعة.');
    if (settlement.mode === 'custom_project' && (!settlement.name || Number(settlement.amount) <= 0)) throw new Error('اكتب اسم المشروع وتكلفته.');
    if (settlement.mode === 'waive' && settlement.internal_reason.length < 5) throw new Error('اكتب سببًا داخليًا واضحًا للتغاضي عن الوقت الزائد.');
  };

  const submit = async event => {
    event.preventDefault(); if (busy) return;
    try {
      const totalMinutes = validateDuration();
      if (!preview && session.billing_unit !== 'reel') throw new Error('انتظر لحظة حتى يكتمل حساب الرصيد.');
      if (hasExcess && step === 1) { setStep(2); return; }
      const settlement = selectedSettlement(); validateSettlement(settlement);
      setBusy(true); setError('');
      const result = await completeStudioSession(session, {
        actualMinutes: totalMinutes, actualReels: Number(actualReels || 0), reason, settlement,
        idempotencyKey, previewHash: preview?.preview_hash || '',
        expectedSessionVersion: preview?.session_version || session.settlement_version || session.session_version || 1,
      });
      await onCompleted?.(result); onClose();
    } catch (requestError) {
      setError(requestError?.message || 'تعذر اعتماد التسوية وإيقاف التصوير. لم يتم إنشاء أي بيانات.');
      if (['stale_settlement_preview', 'settlement_balance_changed'].includes(requestError?.code)) {
        try { setPreview(await previewStudioSessionSettlement(session, inputMinutes)); } catch { /* keep original error */ }
      }
    } finally { setBusy(false); }
  };

  const packageAfter = Math.max(0, Number(newPackage.purchased_minutes || 0) - Number(preview?.excess_minutes || 0));
  const overageAmount = Number(((Number(preview?.excess_minutes || 0) / 60) * Number(custom.hourly_rate || preview?.overage_rate || 0)).toFixed(2));
  const selectedTargetPackage = preview?.eligible_packages?.find(item => String(item.id) === String(existingPackageId));
  const releasedMinutes = Math.max(0, Number(preview?.held_for_booking_minutes || 0) - Math.min(Number(preview?.held_for_booking_minutes || 0), Number(preview?.covered_minutes || 0)));
  const sourceBeforeMinutes = Number(preview?.held_for_booking_minutes || 0) + Number(preview?.free_unheld_original_minutes || 0);
  const customAmount = Number(custom.amount || 0) > 0 ? Number(Number(custom.amount).toFixed(2)) : Number(((Number(preview?.excess_minutes || 0) / 60) * Number(custom.hourly_rate || 0)).toFixed(2));
  const finalPreviewLines = [
    `الباقة الأصلية «${session.package_name || session.service || 'الباقة الحالية'}»: متاح قبل الإنهاء ${durationLabel(sourceBeforeMinutes)}، سيُستهلك ${durationLabel(preview?.covered_minutes || 0)}، ويصبح المتاح ${durationLabel(Math.max(0, sourceBeforeMinutes - Number(preview?.covered_minutes || 0)))}.`,
    releasedMinutes > 0 ? `سيُعاد ${durationLabel(releasedMinutes)} من حجز هذا الموعد غير المستخدم إلى الرصيد الحر.` : 'لن يوجد وقت محجوز غير مستخدم لإعادته.',
  ];
  if (family === 'new_package') finalPreviewLines.push(`إنشاء باقة «${newPackage.name || 'الباقة الجديدة'}» برصيد ${durationLabel(Number(newPackage.purchased_minutes || 0))}؛ يُخصص منها ${durationLabel(preview?.excess_minutes || 0)} ويتبقى ${durationLabel(packageAfter)}.`, `إجمالي الباقة ${moneyLabel(newPackage.total_price || 0)}؛ المدفوع الآن ${moneyLabel(newPackage.initial_paid || 0)}؛ المتبقي ${moneyLabel(Math.max(0, Number(newPackage.total_price || 0) - Number(newPackage.initial_paid || 0)))}. ستُنشأ فاتورة الباقة، ويُسجل إيراد فقط بقيمة المدفوع.`);
  else if (otherMode === 'existing_package') finalPreviewLines.push(`نقل الوقت الزائد إلى باقة «${selectedTargetPackage?.name || 'الباقة المختارة'}»: المتاح قبل ${durationLabel(selectedTargetPackage?.free_minutes || 0)}، المستهلك الآن ${durationLabel(preview?.excess_minutes || 0)}، والمتاح بعدها ${durationLabel(selectedTargetPackage?.remaining_after_minutes || 0)}.`, 'لا فاتورة ولا مديونية جديدة لهذه التسوية.');
  else if (otherMode === 'package_overage') finalPreviewLines.push(`احتساب ${durationLabel(preview?.excess_minutes || 0)} بسعر ${moneyLabel(custom.hourly_rate || preview?.overage_rate || 0)} للساعة.`, `المستحق ${moneyLabel(overageAmount)}؛ المدفوع الآن ${moneyLabel(0)}؛ المتبقي ${moneyLabel(overageAmount)} على الباقة الأصلية دون خصم رصيد إضافي.`);
  else if (otherMode === 'custom_project') finalPreviewLines.push(`إنشاء مشروع «${custom.project_name || 'خدمة وقت تصوير إضافي'}» ووصفه «${custom.description || 'وقت تصوير إضافي'}»، مرتبط بهذه الجلسة.`, `قيمة المشروع والفاتورة ${moneyLabel(customAmount)}؛ المدفوع الآن ${moneyLabel(0)}؛ المتبقي ${moneyLabel(customAmount)}. لن تُسجل إيرادات قبل اعتماد الدفع.`);
  else if (family === 'waive') finalPreviewLines.push(`التغاضي عن ${durationLabel(preview?.excess_minutes || 0)} بالكامل دون خصم أو فاتورة أو مديونية. ستظهر للعميل ملاحظة التسوية الآمنة فقط.`);
  else finalPreviewLines.push(`إنشاء فاتورة «${custom.description || 'وقت تصوير إضافي'}» بقيمة ${moneyLabel(customAmount)}؛ المدفوع الآن ${moneyLabel(0)}؛ المتبقي ${moneyLabel(customAmount)}. لا يُسجل إيراد حتى اعتماد الدفع.`);
  const chooseTemplate = serviceId => {
    const template = preview?.package_templates?.find(item => String(item.id) === String(serviceId));
    setNewPackage(current => template ? { ...current, service_id: String(template.id), name: template.name, purchased_minutes: String(Math.max(Number(template.total_minutes || 0), Number(preview.excess_minutes || 0))), validity_days: String(template.validity_days || 90), total_price: String(template.price || 0) } : { ...current, service_id: '' });
  };

  return <div className="session-stop-overlay" onMouseDown={event => event.target === event.currentTarget && close()}>
    <form ref={dialogRef} className="session-stop-dialog session-stop-dialog--settlement" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="session-stop-title" aria-describedby="session-stop-description" noValidate>
      <header>
        <div className="session-stop-heading"><span><Square /> {step === 1 ? 'إيقاف وحفظ المدة' : 'تسوية الوقت الزائد'}</span><h2 id="session-stop-title">{step === 1 ? 'إيقاف التصوير' : 'كيف تريد احتساب الوقت الزائد؟'}</h2><p id="session-stop-description">{step === 1 ? 'راجع وقت التصوير الفعلي قبل خصمه من الباقة.' : 'سيتم حفظ كل الاختيارات مع الجلسة في عملية واحدة.'}</p></div>
        <button type="button" className="session-stop-close" onClick={close} disabled={busy} aria-label="إغلاق نافذة إيقاف التصوير"><X /></button>
      </header>

      <div className="session-stop-body">
        <dl className="session-stop-context"><div><dt>العميل</dt><dd>{session.client_name || '—'}</dd></div><div><dt>الباقة / الخدمة</dt><dd>{session.package_name || session.service || '—'}</dd></div><div><dt>الموعد</dt><dd>{session.date ? formatBookingDate(session.date) : '—'}{session.start_time ? ` · ${formatTime12(session.start_time)}` : ''}</dd></div></dl>

        {step === 1 && <>
          <section className="session-stop-live" aria-live="polite"><span className="session-stop-pulse" /><div><small>المدة المحسوبة حتى الآن</small><strong>{durationLabel(liveElapsedMinutes)}</strong></div><Clock3 /></section>
          <fieldset className="session-stop-duration"><legend>المدة التي سيتم حفظها</legend><div className="session-stop-duration-fields"><label><span>الساعات</span><input data-dialog-initial type="number" inputMode="numeric" min="0" step="1" value={hours} onChange={event => { setHours(event.target.value); setError(''); }} /></label><span className="session-stop-colon">:</span><label><span>الدقائق</span><input type="number" inputMode="numeric" min="0" max="59" step="1" value={minutes} onChange={event => { setMinutes(event.target.value); setError(''); }} /></label></div><p>يمكن تعديل الساعات والدقائق يدويًا. سيحسب النظام تلقائيًا الجزء المغطى والجزء الزائد.</p></fieldset>
          {session.billing_unit === 'reel' && <label className="session-stop-reels"><span>عدد الريلز التي تم تصويرها</span><input type="number" inputMode="numeric" min="1" step="1" value={actualReels} onChange={event => setActualReels(event.target.value)} /></label>}
          <label className="session-stop-reason"><span>سبب تعديل الوقت <small>(اختياري)</small></span><textarea rows="2" value={reason} onChange={event => setReason(event.target.value)} placeholder="يُحفظ في سجل المراجعة" /></label>
          {previewBusy && <div className="session-stop-preview-loading"><Clock3 /> جارٍ حساب الرصيد المتاح…</div>}
          {preview && <><SummaryCards preview={preview} /><CoverageBar preview={preview} /></>}
          {hasExcess && <div className="session-stop-warning"><AlertTriangle /><p><strong>الجلسة أطول من الوقت المتاح في الباقة الحالية.</strong> يمكنك المتابعة؛ لن يخصم النظام أكثر من رصيدها ولن يستخدم رصيدًا محجوزًا لموعد آخر.</p></div>}
        </>}

        {step === 2 && preview && <>
          <SummaryCards preview={preview} /><CoverageBar preview={preview} destinationLabel={destinationLabel} destinationTone={destinationTone} />
          {isOperations ? <div className="session-operations-handoff"><AlertTriangle /><div><strong>يلزم اعتماد المالك</strong><p>أرسل المدة للمالك للتسوية. ستظل جلسة التصوير نشطة ولن يتم خصم أو إنشاء أي فاتورة.</p></div></div> : <>
            <fieldset className="session-settlement-choices"><legend>طريقة التسوية</legend>
              <SettlementChoice value="new_package" selected={family === 'new_package'} onChange={setFamily} icon={PackagePlus} title="فتح باقة جديدة" description="إنشاء باقة للعميل واستهلاك الوقت الزائد منها الآن" />
              <SettlementChoice value="other" selected={family === 'other'} onChange={setFamily} icon={ArrowLeftRight} title="احتساب بنظام آخر" description="باقة أخرى، سعر إضافي، فاتورة أو مشروع مخصص" />
              <SettlementChoice value="waive" selected={family === 'waive'} onChange={setFamily} icon={HandHeart} title="التغاضي عن الوقت الزائد" description="بدون خصم أو مديونية، مع توثيق السبب" disabled={!isOwner} />
            </fieldset>

            {family === 'new_package' && <section className="session-settlement-panel"><h3><PackagePlus /> تفاصيل الباقة الجديدة</h3><div className="session-settlement-grid">
              <label><span>نموذج الباقة</span><select value={newPackage.service_id} onChange={event => chooseTemplate(event.target.value)}><option value="">اختر النموذج</option>{preview.package_templates?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>اسم الباقة</span><input value={newPackage.name} onChange={event => setNewPackage({ ...newPackage, name: event.target.value })} /></label>
              <label><span>الرصيد بالدقائق</span><input type="number" min={preview.excess_minutes} step="15" value={newPackage.purchased_minutes} readOnly={!isOwner} onChange={event => setNewPackage({ ...newPackage, purchased_minutes: event.target.value })} /></label>
              <label><span>الصلاحية بالأيام</span><input type="number" min="1" value={newPackage.validity_days} readOnly={!isOwner} onChange={event => setNewPackage({ ...newPackage, validity_days: event.target.value })} /></label>
              <label><span>إجمالي السعر</span><input type="number" min="0" step="0.01" value={newPackage.total_price} readOnly={!isOwner} onChange={event => setNewPackage({ ...newPackage, total_price: event.target.value })} /></label>
              <label><span>المدفوع الآن</span><input type="number" min="0" step="0.01" value={newPackage.initial_paid} onChange={event => setNewPackage({ ...newPackage, initial_paid: event.target.value })} /></label>
            </div><label className="session-settlement-note"><span>ملاحظات</span><textarea rows="2" value={newPackage.notes} onChange={event => setNewPackage({ ...newPackage, notes: event.target.value })} /></label><p className="session-settlement-result">سيُخصم {durationLabel(preview.excess_minutes)} الآن، ويتبقى في الباقة الجديدة {durationLabel(packageAfter)}.</p></section>}

            {family === 'other' && <section className="session-settlement-panel"><h3><WalletCards /> اختر النظام البديل</h3><div className="session-other-modes">
              {preview.eligible_packages?.length > 0 && <label><input type="radio" name="other-mode" checked={otherMode === 'existing_package'} onChange={() => setOtherMode('existing_package')} /><span>باقة أخرى للعميل</span></label>}
              {Number(preview.overage_rate) > 0 && <label><input type="radio" name="other-mode" checked={otherMode === 'package_overage'} onChange={() => setOtherMode('package_overage')} /><span>سعر الساعة الإضافية</span></label>}
              {isOwner && <label><input type="radio" name="other-mode" checked={otherMode === 'custom_invoice'} onChange={() => setOtherMode('custom_invoice')} /><span>فاتورة مخصصة</span></label>}
              {isOwner && <label><input type="radio" name="other-mode" checked={otherMode === 'custom_project'} onChange={() => setOtherMode('custom_project')} /><span>مشروع/خدمة مخصصة</span></label>}
            </div>
              {otherMode === 'existing_package' && <label className="session-settlement-note"><span>الباقة المستهدفة</span><select value={existingPackageId} onChange={event => setExistingPackageId(event.target.value)}>{preview.eligible_packages?.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} — متاح {durationLabel(pkg.free_minutes)}</option>)}</select></label>}
              {otherMode === 'package_overage' && <div className="session-settlement-grid"><label><span>سعر الساعة</span><input type="number" min="0.01" step="0.01" value={custom.hourly_rate || preview.overage_rate || ''} readOnly={!isOwner} onChange={event => setCustom({ ...custom, hourly_rate: event.target.value })} /></label><p className="session-settlement-result">المبلغ المستحق: {moneyLabel(overageAmount)}</p></div>}
              {otherMode === 'custom_invoice' && <div className="session-settlement-grid"><label><span>وصف الفاتورة</span><input value={custom.description} onChange={event => setCustom({ ...custom, description: event.target.value })} /></label><label><span>المبلغ الإجمالي</span><input type="number" min="0.01" step="0.01" value={custom.amount} onChange={event => setCustom({ ...custom, amount: event.target.value })} /></label></div>}
              {otherMode === 'custom_project' && <div className="session-settlement-grid"><label><span>اسم المشروع</span><input value={custom.project_name} onChange={event => setCustom({ ...custom, project_name: event.target.value })} /></label><label><span>التكلفة</span><input type="number" min="0.01" step="0.01" value={custom.amount} onChange={event => setCustom({ ...custom, amount: event.target.value })} /></label><label className="wide"><span>الوصف</span><input value={custom.description} onChange={event => setCustom({ ...custom, description: event.target.value })} /></label></div>}
            </section>}

            {family === 'waive' && <section className="session-settlement-panel session-settlement-panel--waive"><h3><HandHeart /> توثيق التغاضي</h3><label className="session-settlement-note"><span>السبب الداخلي <b>مطلوب</b></span><textarea rows="3" value={waiverReason} onChange={event => setWaiverReason(event.target.value)} placeholder="لن يظهر هذا السبب للعميل" /></label><label className="session-settlement-note"><span>ملاحظة للعميل <small>(اختيارية)</small></span><textarea rows="2" value={clientNote} onChange={event => setClientNote(event.target.value)} placeholder="مثال: تمت تسوية الوقت الإضافي دون رسوم" /></label></section>}

            <section className={`session-final-preview session-final-preview--${destinationTone}`}><h3><ReceiptText /> ملخص الاعتماد النهائي</h3><ul>{finalPreviewLines.map((line, index) => <li key={`${destinationTone}-${index}`}>{line}</li>)}</ul><p>بعد الاعتماد ستُغلق الجلسة وتُحدّث الباقات والحسابات والمشروع وواجهة العميل فورًا في عملية واحدة.</p></section>
          </>}
        </>}
        {error && <div className="session-stop-error" role="alert"><AlertTriangle /><span>{error}</span></div>}
      </div>

      <footer>
        {step === 2 && !busy ? <button type="button" className="session-stop-secondary" onClick={() => setStep(1)}><ArrowLeft /> رجوع للمدة</button> : <button type="button" className="session-stop-secondary" onClick={close} disabled={busy}>إلغاء</button>}
        {step === 2 && isOperations ? <button type="button" className="session-stop-primary session-stop-primary--handoff" onClick={close}>إرسال للمالك للتسوية</button> : <button type="submit" className="session-stop-primary" disabled={busy || previewBusy || (session.billing_unit !== 'reel' && !preview)}><Save /> {busy ? 'جارٍ الاعتماد…' : hasExcess && step === 1 ? 'متابعة لتسوية الوقت الزائد' : hasExcess ? 'اعتماد التسوية وإيقاف التصوير' : 'حفظ وإيقاف التصوير'}</button>}
      </footer>
    </form>
  </div>;
}

export default function ERPStopSessionDialog(props) {
  if (!props.session) return null;
  return <StopSessionDialogContent key={props.session.id || props.session.booking_id} {...props} />;
}
