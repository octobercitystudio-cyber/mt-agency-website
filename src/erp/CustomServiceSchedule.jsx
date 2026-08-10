import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import arLocale from '@fullcalendar/core/locales/ar';
import { AlertTriangle, CalendarCheck2, CheckCircle2 } from 'lucide-react';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { safeBookingColor } from './bookingAvailability';
import { customSlotValidation } from './customServiceSlot';

export default function CustomServiceSchedule({ value, onChange, resources = [], bookings = [], sectionRef }) {
  const availability = customSlotValidation(value, bookings);
  const calendarEvents = bookings.map(booking => ({
    id: String(booking.id), title: booking.client_name || booking.service || 'حجز',
    start: booking.date, color: safeBookingColor(booking.client_color || booking.color),
  }));

  return <section ref={sectionRef} className="custom-schedule-card" aria-label="تحديد موعد الخدمة">
    <header><div><span><CalendarCheck2 /></span><div><strong>موعد الخدمة</strong><small>اختر اليوم من التقويم، ثم حدد الوقت.</small></div></div></header>
    <div className="custom-schedule-layout">
      <div className="custom-schedule-calendar">
        <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale={arLocale} direction="rtl" firstDay={6}
          events={calendarEvents} height="auto" fixedWeekCount={false} showNonCurrentDates={false}
          headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
          buttonText={{ today: 'اليوم' }} dateClick={info => onChange({ ...value, date: info.dateStr })}
          dayCellClassNames={arg => arg.date.getDay() === 5 ? ['fc-day-fri'] : []}/>
      </div>
      <div className="custom-schedule-fields">
        <label>الاستوديو / المورد<select required value={value.resource_id || ''} onChange={event => onChange({ ...value, resource_id: event.target.value })}><option value="">اختر المورد</option>{resources.filter(item => item.is_active !== 0 && item.is_active !== false).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>التاريخ<input required type="date" value={value.date || ''} onChange={event => onChange({ ...value, date: event.target.value })}/></label>
        <div className="custom-schedule-time"><label>من<BusinessTimeSelect required min="12:00" max="23:00" value={value.start_time} onChange={event => onChange({ ...value, start_time: event.target.value })}/></label><label>إلى<BusinessTimeSelect required min="13:00" max="24:00" value={value.end_time} onChange={event => onChange({ ...value, end_time: event.target.value })}/></label></div>
        <div className={`custom-slot-status ${availability.available ? 'is-available' : availability.status === 'incomplete' ? 'is-pending' : 'is-conflict'}`} role="status" aria-live="polite">
          {availability.available ? <CheckCircle2 /> : <AlertTriangle />}<span><strong>{availability.available ? 'الموعد متاح' : availability.status === 'incomplete' ? 'فحص الإتاحة' : 'الموعد غير متاح'}</strong><small>{availability.message}</small></span>
        </div>
      </div>
    </div>
  </section>;
}
