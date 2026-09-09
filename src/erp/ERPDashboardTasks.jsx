import { ArrowLeft, CalendarDays, Check, ListTodo, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardTaskDate } from './dashboardTaskDate';
import './ERPDashboardTasks.css';

export default function ERPDashboardTasks({ tasks = [], loading = false, error = '', onRetry, now = new Date() }) {
  return (
    <article className="ops-panel ops-deliveries" aria-labelledby="dashboard-tasks-title" aria-busy={loading}>
      <header className="ops-panel__heading tasks-heading">
        <div><span className="ops-kicker">متابعة العمل</span><h2 id="dashboard-tasks-title">مهام وتسليمات</h2><p>المواعيد المعلقة · بتوقيت القاهرة</p></div>
        <Link to="/erp/reminders">كل المهام <ArrowLeft size={16} aria-hidden="true" /></Link>
      </header>
      {loading ? <div role="status" className="tasks-loading"><span className="visually-hidden">جارٍ تحميل المهام…</span>{[0, 1, 2].map(item => <div key={item} className="tasks-loading__row" aria-hidden="true"><i /><i /></div>)}</div>
        : error ? <div className="tasks-message" role="alert"><AlertTriangle size={27} /><h3>تعذر تحميل المهام</h3><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}>إعادة المحاولة</button>}</div>
          : tasks.length === 0 ? <div className="tasks-message"><Check size={28} /><h3>لا توجد مهام معلقة</h3><p>أضف مهمة أو موعد تسليم لمتابعته هنا.</p><Link to="/erp/reminders">إضافة مهمة <ArrowLeft size={16} /></Link></div>
            : <>
              <div className="tasks-columns" aria-hidden="true"><span>المهمة / النوع</span><span>الموعد</span><span /></div>
              <ul className="tasks-list">{tasks.map(task => {
                const due = dashboardTaskDate(task.due_date, now);
                return <li key={task.id}><Link className="tasks-row" to="/erp/reminders">
                  <div className="tasks-row__identity"><span className="tasks-row__icon"><ListTodo size={18} aria-hidden="true" /></span><div><strong>{task.title || 'مهمة بدون عنوان'}</strong><span className="tasks-row__meta"><span>{task.type || 'مهمة تشغيل'}</span>{due.status && <span className={`tasks-row__status tasks-row__status--${due.status}`}>{due.status === 'overdue' ? 'متأخرة' : 'اليوم'}</span>}</span></div></div>
                  <div className="tasks-row__schedule"><CalendarDays size={14} aria-hidden="true" />{due.dateTime ? <time dateTime={due.dateTime}><span>{due.label}</span>{due.time && <bdi>{due.time}</bdi>}</time> : <span>{due.label}</span>}</div>
                  <ArrowLeft className="tasks-row__arrow" size={17} aria-hidden="true" />
                </Link></li>;
              })}</ul>
              <footer className="tasks-footnote">المعروض: {tasks.length} من المهام المعلقة · مرتبة حسب الموعد</footer>
            </>}
    </article>
  );
}
