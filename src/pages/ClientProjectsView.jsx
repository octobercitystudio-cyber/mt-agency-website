import { CalendarDays, CheckCircle2, CircleDollarSign, FolderKanban, Milestone, WalletCards } from 'lucide-react';
import { formatBookingDate, formatEGP, formatTime12 } from '../lib/businessFormat';
import { ClientPackageCards, ClientPointsCard } from './ClientDashboardOverview';

const SERVICES = {
  reels: 'إنتاج ريلز', advertising: 'إنتاج إعلاني', website: 'تصميم موقع', software: 'تطوير برمجيات',
  podcast: 'إنتاج بودكاست', social_media: 'إدارة سوشيال', event_coverage: 'تغطية فعالية', ai_video: 'فيديو بالذكاء الاصطناعي',
};
const PROJECT_STATUS = { planning: 'في مرحلة التخطيط', active: 'قيد التنفيذ', on_hold: 'متوقف مؤقتًا', completed: 'تم التسليم', cancelled: 'ملغي' };
const MILESTONE_STATUS = { pending: 'قادمة', active: 'المرحلة الحالية', in_progress: 'المرحلة الحالية', completed: 'مكتملة', done: 'مكتملة' };

const safeDate = value => value ? formatBookingDate(String(value).slice(0, 10)) : 'غير محدد';
const progressFor = project => Math.min(100, Math.max(0, Number(project.progress_percent || 0)));

export default function ClientProjectsView({ client, packages = [], projects = [], onBookPackage }) {
  const active = projects.filter(project => ['planning', 'active', 'on_hold'].includes(project.status)).length;
  const average = projects.length ? Math.round(projects.reduce((sum, project) => sum + progressFor(project), 0) / projects.length) : 0;
  const outstanding = projects.reduce((sum, project) => sum + Number(project.financial?.remaining ?? Math.max(0, Number(project.agreed_price || 0) - Number(project.paid_amount || 0))), 0);

  return <section className="client-view client-projects-view" aria-labelledby="client-projects-title">
    <div className="client-page-title client-projects-title"><span>باقاتك وخدماتك</span><h2 id="client-projects-title">الباقات والخدمات</h2><p>افتح التفاصيل التي تحتاجها فقط، وتابع مشروعاتك من مكان واحد.</p></div>
    <ClientPointsCard client={client} compact/>
    <ClientPackageCards packages={packages} points={client?.points} onBookPackage={onBookPackage}/>
    <div className="client-projects-subtitle"><span>الخدمات المخصصة</span><h2>المشروعات الجارية</h2></div>
    <section className="client-project-summary" aria-label="ملخص المشروعات">
      <article><FolderKanban/><div><span>مشروعات نشطة</span><strong>{active.toLocaleString('ar-EG')}</strong></div></article>
      <article><Milestone/><div><span>متوسط التقدم</span><strong>{average.toLocaleString('ar-EG')}%</strong></div></article>
      <article className={outstanding ? 'has-due' : ''}><CircleDollarSign/><div><span>إجمالي المتبقي</span><strong>{formatEGP(outstanding)}</strong></div></article>
    </section>

    {projects.length ? <div className="client-project-list">{projects.map(project => <ClientProjectCard key={project.id} project={project}/>)}</div> : <div className="client-project-empty"><span><FolderKanban/></span><h3>لا توجد مشروعات مخصصة بعد</h3><p>عند بدء خدمة تصميم أو إنتاج أو إدارة محتوى، ستظهر هنا مراحلها ومواعيدها وحالتها المالية.</p></div>}
  </section>;
}

function ClientProjectCard({ project }) {
  const progress = progressFor(project);
  const milestones = project.milestones || [];
  const current = milestones.find(item => ['active', 'in_progress'].includes(item.status)) || milestones.find(item => !['completed', 'done'].includes(item.status));
  const booking = (project.bookings || []).find(item => !['completed', 'cancelled', 'rejected'].includes(item.status)) || project.bookings?.[0];
  const financial = project.financial || {
    total: Number(project.agreed_price || 0), paid: Number(project.paid_amount || 0),
    remaining: Math.max(0, Number(project.agreed_price || 0) - Number(project.paid_amount || 0)),
  };
  return <article className="client-project-card">
    <header>
      <div><span className="client-project-service">{SERVICES[project.service_type] || 'خدمة مخصصة'}</span><h3>{project.name}</h3><p>{PROJECT_STATUS[project.status] || project.status || 'قيد المتابعة'}{current?.title ? ` · الآن: ${current.title}` : ''}</p></div>
      <strong className="client-project-percent">{progress.toLocaleString('ar-EG')}%</strong>
    </header>
    <div className="client-project-progress" aria-label={`نسبة التقدم ${progress}%`}><i><b style={{ width: `${progress}%` }}/></i><span>موعد التسليم: {safeDate(project.due_at)}</span></div>

    {milestones.length ? <div className="client-milestone-journey" aria-label="مراحل المشروع">{milestones.map((milestone, index) => {
      const done = ['completed', 'done'].includes(milestone.status); const active = ['active', 'in_progress'].includes(milestone.status);
      return <div key={milestone.id || index} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}><span>{done ? <CheckCircle2/> : index + 1}</span><strong>{milestone.title}</strong><small>{MILESTONE_STATUS[milestone.status] || 'قادمة'}</small></div>;
    })}</div> : <p className="client-no-milestones">سيضيف فريقنا مراحل التنفيذ قريبًا.</p>}

    <div className="client-project-bottom">
      <dl className="client-project-finance">
        <div><dt>قيمة الاتفاق</dt><dd>{formatEGP(financial.total)}</dd></div>
        <div><dt>المدفوع</dt><dd className="paid">{formatEGP(financial.paid)}</dd></div>
        <div><dt>المتبقي</dt><dd className={Number(financial.remaining) ? 'due' : 'paid'}>{formatEGP(financial.remaining)}</dd></div>
      </dl>
      {booking ? <div className="client-project-booking"><CalendarDays/><div><span>الموعد المرتبط</span><strong>{safeDate(booking.date)}</strong><small>{formatTime12(booking.start_time, '')}{booking.end_time ? ` – ${formatTime12(booking.end_time, '')}` : ''}</small></div></div> : <div className="client-project-booking no-booking"><WalletCards/><div><span>لا يحتاج موعدًا حاليًا</span><small>ستصلك أي مواعيد جديدة هنا.</small></div></div>}
    </div>
  </article>;
}
