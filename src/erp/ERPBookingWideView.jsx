import { useState } from 'react';
import { CalendarPlus, Search, Clock, Check, Ban, RefreshCw, CalendarClock, LockKeyhole, CheckCircle, X } from 'lucide-react';
import { calculateDurationMinutes, formatBookingDate, formatDurationMinutes, formatTime12 } from '../lib/businessFormat';
import { bookingDaySummary, normalizeBookingViewStatus } from '../lib/bookingView';
import { clientColorText } from '../lib/clientColors';
import VerticalBookingCalendar from '../components/VerticalBookingCalendar';
import './ERPBookingWideView.css';
const dateLabel = value => formatBookingDate(value);
function BookingTimes({ start, end }) {
  return <span className="booking-calendar-ticket__time"><span className="booking-calendar-ticket__time-segment">من <bdi className="booking-calendar-ticket__time-value">{formatTime12(start, '')}</bdi></span><span className="booking-calendar-ticket__time-segment">إلى <bdi className="booking-calendar-ticket__time-value">{formatTime12(end, '')}</bdi></span></span>;
}
export default function ERPBookingWideView({ selectedDate, onSelectDate, isAdmin, loading, loadError, blockLoadError, onRefresh, bookings, blocks, events, query, onQueryChange, status, onStatusChange, pendingBookings, decisionBusy, decisionError, onDecision, onAlternative, onNewBooking, onDayActions, onDateClick, onDayDoubleClick, onDateNavigation, onDatesSet, onEventClick, onRescheduleProposal, calendarRootRef, getStatusMeta }) {
  const [pendingOpen, setPendingOpen] = useState(false);
  const filtered = query.trim() !== '' || status !== 'all';
  const summary = bookingDaySummary(bookings, blocks, selectedDate);
  const eventContent = arg => {
    const data = arg.event.extendedProps; const block = data.kind === 'booking_block';
    const meta = block ? { label: 'حجز مؤقت', color: '#956019' } : getStatusMeta(data.status);
    return <div className="booking-calendar-ticket" style={{ '--booking-client-color': block ? '#b77a25' : data.client_color, '--booking-client-text': clientColorText(data.client_color) }}>
      <strong className="booking-calendar-ticket__client">{block ? data.block_title : data.client_name}</strong>
      <BookingTimes start={data.start_time} end={data.end_time} />
      <span className="booking-calendar-ticket__status"><span>{block ? <LockKeyhole aria-hidden="true" /> : <i aria-hidden="true" style={{ background: meta.color }} />}{meta.label}</span><span>{formatDurationMinutes(calculateDurationMinutes(data.start_time, data.end_time))}</span></span>
      {block && data.block_note && <span className="booking-calendar-ticket__note">{data.block_note}</span>}
    </div>;
  };

  return <section className="erp-bookings-wide" aria-label="جدول الحجوزات">
    <header className="bookings-wide-header"><div><p>تنظيم الاستديو</p><h1>جدول الحجوزات</h1></div><div className="bookings-wide-header-actions">
      {isAdmin && <button type="button" className="bookings-wide-button" aria-expanded={pendingOpen} aria-controls="booking-pending-requests" onClick={() => setPendingOpen(open => !open)}><Clock size={17} />طلبات التأكيد <b>{pendingBookings.length}</b></button>}
      {isAdmin && <button type="button" className="bookings-wide-button" onClick={event => onDayActions(event.currentTarget)}><CalendarClock size={18} />إجراءات اليوم</button>}
      {isAdmin && <button type="button" className="bookings-wide-button primary" onClick={event => onNewBooking(event.currentTarget)}><CalendarPlus size={18} />حجز موعد جديد</button>}
    </div></header>

    {isAdmin && pendingOpen && <section id="booking-pending-requests" className="bookings-wide-requests" aria-label="طلبات بانتظار التأكيد"><header><h2>طلبات بانتظار التأكيد <span>{pendingBookings.length}</span></h2><div><button type="button" className="bookings-wide-button" disabled={loading} onClick={onRefresh}><RefreshCw size={16} />تحديث</button><button type="button" className="bookings-wide-icon-button" aria-label="إغلاق طلبات التأكيد" onClick={() => setPendingOpen(false)}><X size={18} /></button></div></header>
      {decisionError && <p className="bookings-wide-error" role="alert">{decisionError}</p>}
      {!pendingBookings.length ? <p className="bookings-wide-empty"><CheckCircle size={22} />لا توجد طلبات جديدة بانتظار القرار.</p> : <div className="bookings-wide-request-list">{pendingBookings.map(booking => <article key={booking.id}><h3>{booking.client_name}</h3><p>{formatBookingDate(booking.date)}</p><BookingTimes start={booking.start_time} end={booking.end_time} /><p>{booking.service}</p>{booking.notes && <p>{booking.notes}</p>}<div className="bookings-wide-request-actions"><button type="button" className="bookings-wide-button confirm" disabled={Boolean(decisionBusy)} onClick={() => onDecision(booking, 'confirm')}><Check size={16} />{decisionBusy === `confirm-${booking.id}` ? 'جارٍ التأكيد...' : 'تأكيد'}</button><button type="button" className="bookings-wide-button" disabled={Boolean(decisionBusy)} onClick={() => onAlternative(booking)}><CalendarPlus size={16} />موعد بديل</button><button type="button" className="bookings-wide-button reject" disabled={Boolean(decisionBusy)} onClick={() => { if (window.confirm(`رفض طلب ${booking.client_name}؟`)) onDecision(booking, 'reject'); }}><Ban size={16} />{decisionBusy === `reject-${booking.id}` ? 'جارٍ الرفض...' : 'رفض'}</button></div></article>)}</div>}
    </section>}

    {loadError && <p className="bookings-wide-error" role="alert">{loadError}<button type="button" onClick={onRefresh}>إعادة المحاولة</button></p>}
    {blockLoadError && <p className="bookings-wide-error" role="alert">{blockLoadError}<button type="button" onClick={onRefresh}>إعادة المحاولة</button></p>}
    <div className="bookings-wide-summary" aria-live="polite"><strong>{dateLabel(selectedDate)}</strong><span><b>{summary.total}</b> مواعيد{filtered ? ' مطابقة' : ''}</span><span><b>{summary.confirmed}</b> مؤكدة</span>{isAdmin && <span><b>{summary.temporary}</b> مؤقتة</span>}<span><b>{summary.inProgress}</b> تصوير جارٍ</span>{summary.completed > 0 && <span><b>{summary.completed}</b> مكتملة</span>}</div>
    <div className="bookings-wide-layout bookings-wide-layout--vertical">
      <section className="bookings-wide-calendar-panel" aria-label="تقويم المواعيد">
        <div className="bookings-wide-filters"><label className="bookings-wide-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="ابحث باسم العميل أو عنوان الحجز" placeholder="ابحث باسم العميل أو عنوان الحجز" value={query} onChange={event => onQueryChange(event.target.value)}/></label><select aria-label="تصفية حالة الحجز" value={status} onChange={event => onStatusChange(event.target.value)}><option value="all">كل الحالات</option><option value="confirmed">مؤكد</option>{isAdmin && <option value="temporary">حجز مؤقت</option>}<option value="pending">بانتظار التأكيد</option><option value="in_progress">تصوير جارٍ</option><option value="completed">مكتمل</option><option value="alternative_proposed">موعد بديل مقترح</option><option value="cancel_requested">طلب إلغاء</option><option value="late_cancel_requested">إلغاء متأخر</option></select></div>
        {filtered && <p className="bookings-wide-filter-note">تظهر المواعيد المطابقة للبحث والحالة فقط؛ إخفاء موعد لا يعني أن فترته متاحة.<button type="button" onClick={() => { onQueryChange(''); onStatusChange('all'); }}>مسح التصفية</button></p>}
        {loading && <p className="bookings-wide-loading" role="status"><RefreshCw size={17}/>جارٍ تحميل المواعيد...</p>}
        <div ref={calendarRootRef} className="bookings-wide-vertical-calendar">
          <VerticalBookingCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} events={events} datesSet={onDatesSet}
            onNavigate={onDateNavigation} onDateClick={onDateClick} onDayDoubleClick={isAdmin ? onDayDoubleClick : undefined}
            dayActionLabel={isAdmin ? 'حجز موعد يوم' : 'عرض يوم'} label="تقويم الحجوزات العمودي"
            emptyText={loading ? 'جارٍ تحميل المواعيد…' : loadError || blockLoadError ? 'قد تكون البيانات غير مكتملة؛ حدّث المواعيد والإغلاقات قبل الحجز.' : filtered ? 'التقويم يعرض المواعيد المطابقة للتصفية فقط؛ الخانات الفارغة لا تؤكد الإتاحة.' : 'تُراجع إتاحة الموعد عند الحجز؛ الخانات الفارغة لا تمثل تأكيدًا للإتاحة.'}
            eventClick={onEventClick} eventContent={eventContent}
            eventClassNames={({ event }) => [event.extendedProps.kind === 'booking_block' ? 'booking-status-temporary' : 'booking-status-' + normalizeBookingViewStatus(event.extendedProps.status)]}
            eventAction={event => isAdmin && event.extendedProps.reschedule_eligible && <button type="button" className="vertical-calendar-change" onClick={click => { click.stopPropagation(); onDateNavigation?.(); onRescheduleProposal({ event: { ...event, start: new Date(event.start), end: new Date(event.end) }, el: click.currentTarget, revert: () => {} }); }}><CalendarClock aria-hidden="true"/>تغيير الموعد</button>}
          />
        </div>
        <footer className="bookings-wide-legend"><span><i className="confirmed"/>مؤكد</span>{isAdmin && <span><i className="temporary"/>حجز مؤقت</span>}<span><i className="completed"/>مكتمل</span><span>لون الموعد هو لون العميل</span></footer>
      </section>
    </div>
    <p className="bookings-wide-help">{isAdmin ? <>نقرة واحدة على اليوم لحجز موعد لعميل. <strong>نقرتان على مساحة فارغة أو رقم اليوم</strong> لخيارات الحجز المؤقت وبدء التصوير. لتعديل حجز مؤكد استخدم زر «تغيير الموعد» داخل بطاقته.</> : 'نقرة واحدة لاختيار اليوم.'} كل المواعيد بتوقيت القاهرة.</p>
  </section>;
}
