import { useId } from 'react';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { formatTime12 } from '../lib/businessFormat';
import { PICKUP_WEEKDAYS, PICKUP_DAY_ORDER } from '../lib/pickupWeekdays';
import './CompanyPickupSchedule.css';

export default function CompanyPickupSchedule({ schedule, preview = false }) {
  const titleId = useId();
  const windows = Array.isArray(schedule?.windows) ? schedule.windows : [];
  const enabled = (schedule?.enabled === true || Number(schedule?.enabled) === 1) && windows.length > 0;
  return <section className={`company-pickup-schedule${preview ? ' company-pickup-schedule--preview' : ''}`} aria-labelledby={titleId} dir="rtl">
    <header className="company-pickup-schedule__head">
      <span className="company-pickup-schedule__icon"><MapPin aria-hidden="true" /></span>
      <div><span className="company-pickup-schedule__eyebrow">{preview ? 'معاينة ما سيظهر للعملاء' : 'الاستلام من مقر الشركة'}</span><h3 id={titleId}>مواعيد استلام الفيديوهات من مقر الشركة</h3></div>
      {enabled && <span className="company-pickup-schedule__badge"><CalendarDays aria-hidden="true" /> أسبوعيًا</span>}
    </header>
    {enabled ? <><p className="company-pickup-schedule__intro"><Clock3 aria-hidden="true" /> كل المواعيد بتوقيت القاهرة، وتتكرر أسبوعيًا حتى تحديثها.</p>
      <dl className="company-pickup-schedule__days">{PICKUP_DAY_ORDER.filter(day => windows.some(window => Number(window.weekday) === day)).map(day => <div className="company-pickup-schedule__day" key={day}><dt>{PICKUP_WEEKDAYS[day]}</dt><dd>{windows.filter(window => Number(window.weekday) === day).sort((a, b) => a.start_time.localeCompare(b.start_time)).map((window, index) => <span className="company-pickup-schedule__range" key={`${window.start_time}-${index}`}><span>من <bdi>{formatTime12(window.start_time, window.start_time)}</bdi></span><span>إلى <bdi>{formatTime12(window.end_time, window.end_time)}</bdi></span></span>)}</dd></div>)}</dl>
      {schedule.note?.trim() && <p className="company-pickup-schedule__note">{schedule.note}</p>}
      <p className="company-pickup-schedule__disclaimer">هذه مواعيد الاستلام العامة. تأكد أن حالة جلستك «جاهز للاستلام» قبل الحضور؛ الجدول لا يؤكد جاهزية الجلسات ولا يحجز موعد تصوير.</p>
    </> : <p className="company-pickup-schedule__empty">لم تُعلن مواعيد الاستلام بعد. تواصل مع الشركة لتنسيق الاستلام.</p>}
  </section>;
}
