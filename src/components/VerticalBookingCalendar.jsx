import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cairoDateKey, formatBookingDate } from '../lib/businessFormat';
import { groupVerticalCalendarEvents, shiftVerticalCalendar, verticalCalendarRange } from '../lib/verticalCalendarDates';
import './VerticalBookingCalendar.css';

const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const localDate = value => new Date(`${value}T00:00:00`);

const VerticalBookingCalendar = forwardRef(function VerticalBookingCalendar({
  events = [], initialDate, selectedDate, onSelectDate, onDateClick, onDayDoubleClick,
  onNavigate, datesSet, eventClick, eventContent, eventClassNames, eventAction,
  emptyText = 'لا توجد مواعيد ظاهرة لهذا اليوم.', dayActionLabel = 'عرض يوم', label = 'التقويم العمودي',
}, ref) {
  const [anchor, setAnchor] = useState(initialDate || selectedDate || cairoDateKey());
  const [view, setView] = useState('month');
  const [focusDate, setFocusDate] = useState(selectedDate || '');
  const [focusRevision, setFocusRevision] = useState(0);
  const scroller = useRef(null);
  const callbacks = useRef({ datesSet, onSelectDate, onNavigate });
  useEffect(() => { callbacks.current = { datesSet, onSelectDate, onNavigate }; }, [datesSet, onSelectDate, onNavigate]);
  const range = useMemo(() => verticalCalendarRange(anchor, view), [anchor, view]);
  const grouped = useMemo(() => groupVerticalCalendarEvents(events, range.days), [events, range.days]);
  const title = view === 'month' ? monthName.format(new Date(`${range.start}T12:00:00Z`)) : `${formatBookingDate(range.start)} — ${formatBookingDate(range.days.at(-1))}`;
  const gotoDate = value => {
    if (!verticalCalendarRange(value).days.length) return;
    callbacks.current.onNavigate?.();
    setAnchor(value); setFocusDate(value); setFocusRevision(revision => revision + 1);
    callbacks.current.onSelectDate?.(value);
  };
  useImperativeHandle(ref, () => ({ getApi: () => ({ gotoDate }) }));
  useEffect(() => {
    callbacks.current.datesSet?.({ start: localDate(range.start), end: localDate(range.endExclusive), startStr: range.start, endStr: range.endExclusive, view: { type: view, currentStart: localDate(range.start), currentEnd: localDate(range.endExclusive), title } });
  }, [range.start, range.endExclusive, title, view]);
  useEffect(() => {
    if (!selectedDate || !verticalCalendarRange(selectedDate).days.length) return;
    setAnchor(selectedDate); setFocusDate(selectedDate); setFocusRevision(revision => revision + 1);
  }, [selectedDate]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = scroller.current;
      const row = container?.querySelector(`[data-date="${focusDate}"]`);
      if (row) container.scrollTo({ top: container.scrollTop + row.getBoundingClientRect().top - container.getBoundingClientRect().top, behavior: 'instant' });
      else container?.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [range.start, range.endExclusive, focusDate, focusRevision]);
  const navigate = direction => gotoDate(direction === 0 ? cairoDateKey() : shiftVerticalCalendar(anchor, view, direction));
  const dayClick = (date, event) => {
    if (event.target.closest('[data-calendar-event]')) return;
    const dayEl = event.target.closest('[data-day-button]') || event.currentTarget;
    if (onDateClick) onDateClick({ dateStr: date, dayEl, jsEvent: event.nativeEvent });
    else { setFocusDate(date); callbacks.current.onSelectDate?.(date); }
  };
  const dayDouble = (date, event) => {
    if (event.target.closest('[data-calendar-event]')) return;
    event.stopPropagation();
    onDayDoubleClick?.(date, event.target.closest('[data-day-button]') || event.currentTarget);
  };
  return <section className="vertical-calendar" aria-label={label} dir="rtl">
    <header className="vertical-calendar-toolbar"><div><span>الأيام مرتبة من الأقدم إلى الأحدث</span><h3 aria-live="polite">{title}</h3></div><div className="vertical-calendar-navigation"><button type="button" aria-label={view === 'week' ? 'الأسبوع السابق' : 'الشهر السابق'} onClick={() => navigate(-1)}><ChevronRight aria-hidden="true"/></button><button type="button" onClick={() => navigate(0)}>اليوم</button><button type="button" aria-label={view === 'week' ? 'الأسبوع التالي' : 'الشهر التالي'} onClick={() => navigate(1)}><ChevronLeft aria-hidden="true"/></button></div></header>
    <div className="vertical-calendar-tools"><div className="vertical-calendar-view" aria-label="الفترة المعروضة"><button type="button" aria-pressed={view === 'month'} onClick={() => { callbacks.current.onNavigate?.(); setView('month'); }}>شهر</button><button type="button" aria-pressed={view === 'week'} onClick={() => { callbacks.current.onNavigate?.(); setView('week'); }}>أسبوع</button></div><label><CalendarDays aria-hidden="true"/>انتقل إلى تاريخ<input type="date" aria-label="انتقل إلى تاريخ" value={focusDate || anchor} onChange={event => gotoDate(event.target.value)}/></label></div>
    <div ref={scroller} className="vertical-calendar-days" tabIndex={0} role="region" aria-label="أيام الفترة المعروضة">
      {range.days.map(date => <section className={`vertical-calendar-day${date === (selectedDate || focusDate) ? ' is-selected' : ''}${date === cairoDateKey() ? ' is-today' : ''}`} key={date} data-date={date} onClick={event => dayClick(date, event)} onDoubleClick={event => dayDouble(date, event)}>
        <header><button type="button" data-day-button aria-label={`${dayActionLabel} ${formatBookingDate(date)}`} aria-current={date === (selectedDate || focusDate) ? 'date' : undefined} aria-keyshortcuts={onDayDoubleClick ? 'Shift+Enter' : undefined} onKeyDown={event => { if (onDayDoubleClick && event.shiftKey && event.key === 'Enter') { event.preventDefault(); dayDouble(date, event); } }}><span>{dayName.format(new Date(`${date}T12:00:00Z`))}</span><strong>{Number(date.slice(8))}</strong><small>{date}{date === cairoDateKey() ? ' · اليوم' : ''}</small></button></header>
        <div className="vertical-calendar-day-events">{grouped.get(date).length ? grouped.get(date).map(event => {
          const classes = eventClassNames?.({ event }) || event.classNames || [];
          return <article key={event.id} data-calendar-event className={`vertical-calendar-event ${Array.isArray(classes) ? classes.join(' ') : classes}`} style={{ '--calendar-event-bg': event.backgroundColor || '#f6f2fb', '--calendar-event-border': event.borderColor || '#dacee9', '--calendar-event-text': event.textColor || '#443255' }}>
            <button type="button" className="vertical-calendar-event-main" onClick={click => { click.stopPropagation(); eventClick?.({ event, el: click.currentTarget, jsEvent: click.nativeEvent }); }} onDoubleClick={click => click.stopPropagation()} aria-label={`${event.title || ''}، ${formatBookingDate(date)}، ${event.extendedProps?.timeLabel || [event.extendedProps?.start_time, event.extendedProps?.end_time].filter(Boolean).join(' إلى ')}، ${event.extendedProps?.marker?.label || ''}`}>{eventContent ? eventContent({ event }) : event.title}</button>
            {eventAction?.(event)}
          </article>;
        }) : <p className="vertical-calendar-empty">{emptyText}</p>}</div>
      </section>)}
    </div>
    <p className="vertical-calendar-scroll-note">مرّر رأسيًا بين الأيام؛ جميع أيام الفترة ظاهرة، بما فيها الأيام بلا مواعيد.</p>
  </section>;
});

export default VerticalBookingCalendar;
