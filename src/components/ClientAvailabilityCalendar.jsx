import { CalendarDays, ChevronLeft, ChevronRight, Clock3, RefreshCw } from 'lucide-react';
import { formatBookingDate, formatDurationMinutes, formatTime12, timeToMinutes } from '../lib/businessFormat';
import './ClientAvailabilityCalendar.css';
const weekdays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const reasons = { friday: 'إجازة الجمعة', outside_validity: 'خارج صلاحية الباقة', already_booked: 'لديك موعد في هذا اليوم', past: 'موعد سابق', full: 'لا توجد فترة متصلة بهذه المدة', notice: 'أقل من مهلة التعديل المطلوبة' };
const compact = value => String(value || '').slice(0, 5);
const time = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export default function ClientAvailabilityCalendar({ monthWindow, data, loading, error, onRetry, onMonthChange, selectedDate, onDateChange, selectedSlot, onSlotChange, durationMinutes, disabledDates = [], disabled = false, validityLabel }) {
  const month = monthWindow.month;
  const first = new Date(`${month}T12:00:00Z`);
  const dayCount = Number.isNaN(first.getTime()) ? 0 : new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const padding = (first.getUTCDay() + 1) % 7;
  const monthLabel = dayCount ? new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first) : '';
  const byDate = new Map((data?.days || []).map(day => [day.date, day]));
  const selectedDay = byDate.get(selectedDate);
  const draftDay = disabledDates.includes(selectedDate);
  const availableSlots = selectedDay?.available && !draftDay ? [...new Map((selectedDay.slots || []).map(slot => [`${compact(slot.start_time)}-${compact(slot.end_time)}`, slot])).values()] : [];
  const occupied = selectedDay?.busy_intervals || [];
  const unavailableMessage = draftDay ? 'أضفت موعدًا لهذا اليوم بالفعل. احذفه من القائمة أولًا إذا أردت اختيار فترة أخرى.' : reasons[selectedDay?.unavailable_reason] || (selectedDay?.has_client_booking ? reasons.already_booked : 'لا توجد مواعيد متاحة بهذه المدة. جرّب يومًا أو مدة أخرى.');
  return <section className="client-availability-calendar" aria-label="تقويم المواعيد المتاحة" aria-busy={loading}>
    <nav className="cac-month-nav" aria-label="التنقل بين شهور الحجز"><button type="button" onClick={() => onMonthChange(-1)} disabled={disabled || loading || !monthWindow.canPrevious} aria-label="الشهر السابق"><ChevronRight/></button><div><h3>{monthLabel}</h3><p>{validityLabel || 'يمكنك التنقل للشهور التالية ضمن صلاحية الباقة'}</p></div><button type="button" onClick={() => onMonthChange(1)} disabled={disabled || loading || !monthWindow.canNext} aria-label="الشهر التالي"><ChevronLeft/></button></nav>
    <div className="cac-legend"><span><i className="available"/> متاح</span><span><i className="occupied"/> محجوز / غير متاح</span><span><i className="selected"/> اختيارك</span></div>
    {error ? <div className="cac-state cac-error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}><RefreshCw/> إعادة المحاولة</button></div> : <>
      <div className="cac-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="cac-month-grid" aria-label={monthLabel}>{Array.from({ length: padding || 0 }, (_, i) => <span key={`padding-${i}`} className="cac-padding"/>)}{Array.from({ length: dayCount }, (_, i) => {
        const date = `${month.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`; const day = byDate.get(date); const isDraft = disabledDates.includes(date); const available = day?.available && !isDraft; const friday = new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
        const label = isDraft ? 'اختيارك' : friday ? 'إجازة' : day?.has_client_booking ? 'لك موعد' : available ? 'متاح' : 'غير متاح';
        return <button type="button" key={date} data-date={date} disabled={disabled || loading || !day} aria-pressed={selectedDate === date} aria-label={`${formatBookingDate(date)}، ${label}`} className={`${available ? 'is-available' : 'is-unavailable'}${selectedDate === date ? ' is-selected' : ''}${isDraft ? ' is-draft' : ''}`} onClick={() => onDateChange(date)}><strong>{i + 1}</strong><small>{label}</small>{Boolean(day?.busy_intervals?.length) && <span className="cac-busy-mark" aria-label="يحتوي على فترات محجوزة"/>}</button>;
      })}</div>
      {loading && <p className="cac-loading" role="status"><RefreshCw className="client-spin"/> جارٍ تحميل المواعيد المتاحة…</p>}
      {!loading && !disabled && data && !data.days?.some(day => day.available && !disabledDates.includes(day.date)) && <p className="cac-state">لا توجد فترة تناسب المدة في هذا الشهر.{monthWindow.canNext ? ' يمكنك الانتقال للشهر التالي.' : ' جرّب مدة أخرى ضمن رصيد الباقة.'}</p>}
      {!loading && selectedDay ? <div className="cac-day-panel"><header><div><span>اليوم المحدد</span><h4>{formatBookingDate(selectedDate)}</h4></div><span className="cac-duration"><Clock3/>{formatDurationMinutes(durationMinutes)}</span></header>
        {!['friday', 'outside_validity', 'past'].includes(selectedDay.unavailable_reason) && <><div className="cac-timeline-labels"><span>12 ظهرًا</span><span>5 مساءً</span><span>10 مساءً</span></div><div className="cac-timeline" aria-label="الفترات المحجوزة من 12 ظهرًا حتى 10 مساءً">{Array.from({ length: 20 }, (_, index) => { const start = 720 + index * 30; const end = start + 30; const busy = occupied.some(range => timeToMinutes(range.start_time) < end && timeToMinutes(range.end_time) > start); const chosen = selectedSlot && timeToMinutes(selectedSlot.start_time) < end && timeToMinutes(selectedSlot.end_time) > start; return <span key={start} className={chosen ? 'is-selected' : busy ? 'is-busy' : ''} title={`${formatTime12(time(start))} إلى ${formatTime12(time(end))}: ${chosen ? 'اختيارك' : busy ? 'محجوز / غير متاح' : 'لا يوجد حجز'}`}/>; })}</div><div className="cac-busy-list">{occupied.length ? occupied.map((range, index) => <span key={index}>محجوز: <b>{formatTime12(range.start_time)} – {formatTime12(range.end_time)}</b></span>) : <span>لا توجد فترات محجوزة في هذا اليوم.</span>}</div></>}
        <h5>اختر فترة تصوير متصلة</h5>{availableSlots.length ? <div className="cac-slots">{availableSlots.map(slot => { const chosen = selectedSlot && compact(selectedSlot.start_time) === compact(slot.start_time) && compact(selectedSlot.end_time) === compact(slot.end_time); return <button type="button" key={`${slot.start_time}-${slot.end_time}`} aria-pressed={Boolean(chosen)} disabled={disabled} className={chosen ? 'is-selected' : ''} onClick={() => onSlotChange(slot)}><strong>{formatTime12(slot.start_time)}</strong><span>إلى</span><strong>{formatTime12(slot.end_time)}</strong></button>; })}</div> : <p className="cac-state" role="status">{unavailableMessage}</p>}
      </div> : !loading && <div className="cac-prompt"><CalendarDays/><p>{disabled ? 'اختر الباقة ومدة لا تقل عن ساعة لعرض الإتاحة.' : 'اختر يومًا لعرض الفترات المحجوزة ومواعيد التصوير المتاحة.'}</p></div>}
    </>}
    <p className="cac-policy">جلسة واحدة متصلة في اليوم، بحد أدنى ساعة. كل المواعيد بانتظار موافقة الإدارة.</p>
  </section>;
}
