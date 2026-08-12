import { useEffect, useState } from 'react';
import {
  BriefcaseBusiness, CalendarClock, CalendarPlus, CircleDollarSign,
  Coins, Edit3, FileText, History, Mail, MessageCircle, PackageCheck, Phone,
  Play, SearchX, UserRound, WalletCards, X,
} from 'lucide-react';
import { centsToMoney, formatBookingDate, formatEGP, formatPackageQuantity, formatTime12, packageFinancialSummary, packageQuantitySummary, remainingCalendarDays } from '../lib/businessFormat';
import OwnerRecordActions from './OwnerRecordActions';

const money = formatEGP;
const bookingDate = booking => booking?.date ? formatBookingDate(booking.date) : 'لا يوجد موعد قادم';

const StatusPill = ({ tone = 'neutral', children }) => <span className={`client-crm-status client-crm-status--${tone}`}>{children}</span>;

const ClientAvatar = ({ client, large = false }) => (
  <span className={`client-crm-avatar ${large ? 'client-crm-avatar--large' : ''}`} style={{ '--client-avatar': client.color || '#6d28d9' }} aria-hidden="true">
    {client.name?.trim().charAt(0) || 'ع'}
  </span>
);

export function ClientDirectory({
  clients,
  loading,
  error,
  selectedIds,
  onToggleAll,
  onToggleOne,
  onOpen,
  onBook,
  onEdit,
  onDelete,
  currentUser,
  onRetry,
}) {
  if (loading && clients.length === 0) return <DirectoryState loading title="جارٍ تجهيز دليل العملاء" text="نسترجع بيانات العملاء وحالتهم التشغيلية." />;
  if (error && clients.length === 0) return <DirectoryState title="تعذر تحميل العملاء" text={error} action="إعادة المحاولة" onAction={onRetry} />;
  if (clients.length === 0) return <DirectoryState title="لا توجد نتائج مطابقة" text="غيّر البحث أو عوامل التصفية لعرض عملاء آخرين." />;

  const allSelected = clients.every(client => selectedIds.includes(client.id));
  return (
    <section className="client-crm-directory" aria-label="دليل العملاء">
      <header className="client-crm-directory__head">
        <label className="client-crm-select-all"><input type="checkbox" checked={allSelected} onChange={onToggleAll} /> تحديد النتائج الظاهرة</label>
        <span>{clients.length.toLocaleString('ar-EG')} عميل</span>
      </header>
      <div className="client-crm-list">
        {clients.map(client => (
          <ClientDirectoryItem
            key={client.id}
            client={client}
            checked={selectedIds.includes(client.id)}
            onToggle={() => onToggleOne(client.id)}
            onOpen={() => onOpen(client)}
            onBook={() => onBook(client)}
            onEdit={() => onEdit(client)}
            onDelete={() => onDelete(client)}
            currentUser={currentUser}
          />
        ))}
      </div>
    </section>
  );
}

function ClientDirectoryItem({ client, checked, onToggle, onOpen, onBook, onEdit, onDelete, currentUser }) {
  const hasDue = Number(client.debt) > 0 || client.hasPackageDebt;
  const packageCount = client.packagesList?.length || 0;
  return (
    <article className="client-crm-item">
      <label className="client-crm-item__select" aria-label={`تحديد ${client.name}`} onClick={event => event.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </label>
      <button className="client-crm-item__profile" type="button" onClick={onOpen} aria-label={`فتح تفاصيل ${client.name}`}>
        <ClientAvatar client={client} />
        <span className="client-crm-item__identity">
          <span className="client-crm-item__name"><strong>{client.name}</strong>{client.isActive && <StatusPill tone="success">نشط</StatusPill>}{hasDue && <StatusPill tone="danger">مستحق</StatusPill>}</span>
          <span><BriefcaseBusiness size={14} /> {client.job || 'نوع العميل غير مسجل'}</span>
        </span>
      </button>
      <div className="client-crm-item__contact">
        <a href={`tel:${client.phone1}`} dir="ltr"><Phone size={15} /> {client.phone1 || 'لا يوجد هاتف'}</a>
        <span dir={client.email ? 'ltr' : 'rtl'}><Mail size={15} /> {client.email || 'لا يوجد بريد مسجل'}</span>
      </div>
      <div className="client-crm-item__relationship">
        <span><PackageCheck size={15} /> {packageCount ? `${packageCount} باقة/خدمة نشطة` : 'لا توجد باقة نشطة'}</span>
        <span><CalendarClock size={15} /> {client.nextBooking ? `${bookingDate(client.nextBooking)} · ${formatTime12(client.nextBooking.start_time)}` : 'لا يوجد موعد قادم'}</span>
      </div>
      <div className="client-crm-item__balance">
        <span>الرصيد المالي</span>
        <strong className={hasDue ? 'is-due' : Number(client.credit) > 0 ? 'is-credit' : ''}>{hasDue ? `مستحق ${money(client.debt)}` : Number(client.credit) > 0 ? `دائن ${money(client.credit)}` : 'متوازن'}</strong>
      </div>
      <div className="client-crm-item__actions">
        <button className="primary" type="button" onClick={onOpen}><UserRound size={16} /> التفاصيل</button>
        <button type="button" onClick={onBook}><CalendarPlus size={16} /> حجز</button>
        {currentUser?.role === 'owner' ? <OwnerRecordActions user={currentUser} entity="clients" record={client} label={client.name} onEdit={onEdit} onChanged={onDelete} /> : <button type="button" onClick={onEdit}><Edit3 size={16} /> تعديل</button>}
      </div>
    </article>
  );
}

function DirectoryState({ title, text, loading = false, action, onAction }) {
  return (
    <section className="client-crm-state" aria-live="polite">
      {loading ? <span className="client-crm-loader" /> : <SearchX size={34} />}
      <h2>{title}</h2><p>{text}</p>
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </section>
  );
}

export function ClientProfileDrawer({
  client,
  activePackages,
  formatHours,
  onClose,
  onEdit,
  onBook,
  onOpenCalendar,
  onWhatsApp,
  onFinance,
  onStartSession,
  onOpenHistory,
}) {
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [onClose]);

  const hasDue = Number(client.debt) > 0 || client.hasPackageDebt;
  const tabs = [
    ['overview', UserRound, 'نظرة عامة'],
    ['packages', PackageCheck, 'الباقات'],
    ['bookings', CalendarClock, 'المواعيد'],
    ['finance', CircleDollarSign, 'المالية'],
  ];

  return (
    <div className="client-crm-drawer-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <aside className="client-crm-drawer" role="dialog" aria-modal="true" aria-labelledby="client-profile-title">
        <header className="client-crm-profile-head">
          <button className="client-crm-close" type="button" onClick={onClose} aria-label="إغلاق تفاصيل العميل"><X /></button>
          <div className="client-crm-profile-head__identity">
            <ClientAvatar client={client} large />
            <div><span>ملف العميل</span><h2 id="client-profile-title">{client.name}</h2><p>{client.job || 'نوع العميل غير مسجل'} · {client.phone1 || 'دون هاتف'}</p></div>
          </div>
          <div className="client-crm-profile-head__badges">{client.isActive && <StatusPill tone="success">نشط حاليًا</StatusPill>}{hasDue && <StatusPill tone="danger">لديه مستحقات</StatusPill>}</div>
          <div className="client-crm-profile-head__actions">
            {client.phone1 && <a href={`tel:${client.phone1}`}><Phone size={16} /> اتصال</a>}
            {client.phone1 && <button type="button" onClick={onWhatsApp}><MessageCircle size={16} /> واتساب</button>}
            <button type="button" onClick={onEdit}><Edit3 size={16} /> تعديل الملف</button>
          </div>
        </header>

        <section className="client-crm-metrics" aria-label="ملخص العميل">
          <ClientMetric icon={PackageCheck} label="باقات نشطة" value={activePackages.length} />
          <ClientMetric icon={Coins} label="نقاط" value={Number(client.points || 0).toLocaleString('ar-EG')} />
          <ClientMetric icon={CircleDollarSign} label="مديونية" value={money(client.debt)} tone={Number(client.debt) > 0 ? 'danger' : ''} />
          <ClientMetric icon={WalletCards} label="رصيد دائن" value={money(client.credit)} tone={Number(client.credit) > 0 ? 'success' : ''} />
        </section>

        <nav className="client-crm-tabs" role="tablist" aria-label="أقسام ملف العميل">
          {tabs.map(([key, Icon, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} /> {label}</button>)}
        </nav>

        <div className="client-crm-tab-panel" role="tabpanel">
          {tab === 'overview' && <OverviewTab client={client} onBook={onBook} onOpenHistory={onOpenHistory} />}
          {tab === 'packages' && <PackagesTab client={client} packages={activePackages} formatHours={formatHours} onFinance={onFinance} onStartSession={onStartSession} onOpenHistory={onOpenHistory} />}
          {tab === 'bookings' && <BookingsTab client={client} onBook={onBook} onOpenCalendar={onOpenCalendar} onOpenHistory={onOpenHistory} />}
          {tab === 'finance' && <FinanceTab client={client} onFinance={onFinance} onOpenHistory={onOpenHistory} />}
        </div>
      </aside>
    </div>
  );
}

function ClientMetric({ icon: Icon, label, value, tone = '' }) {
  return <article className={tone}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>;
}

function OverviewTab({ client, onBook, onOpenHistory }) {
  return <div className="client-crm-overview">
    <section className="client-crm-section"><header><div><span>بيانات التواصل</span><h3>الملف الأساسي</h3></div></header><dl className="client-crm-data-list"><div><dt>الهاتف الأساسي</dt><dd dir="ltr">{client.phone1 || '—'}</dd></div><div><dt>هاتف إضافي</dt><dd dir="ltr">{client.phone2 || '—'}</dd></div><div><dt>البريد الإلكتروني</dt><dd dir="ltr">{client.email || 'غير مسجل'}</dd></div><div><dt>النوع / العمل</dt><dd>{client.job || 'غير مسجل'}</dd></div></dl></section>
    <section className="client-crm-section"><header><div><span>الحالة التشغيلية</span><h3>العلاقة الحالية</h3></div></header><div className="client-crm-relationship-summary"><p><PackageCheck />{client.packagesList?.length ? client.packagesList.join('، ') : 'لا توجد خدمات نشطة مشتقة من الحجوزات.'}</p><p><CalendarClock />{client.nextBooking ? `الموعد القادم ${bookingDate(client.nextBooking)} الساعة ${formatTime12(client.nextBooking.start_time)}` : 'لا يوجد موعد قادم مسجل.'}</p></div><button className="client-crm-primary-action" type="button" onClick={onBook}><CalendarPlus /> حجز / إضافة خدمة</button></section>
    <section className="client-crm-history-strip"><button onClick={() => onOpenHistory('packages')}><History /> سجل الباقات</button><button onClick={() => onOpenHistory('bookings')}><CalendarClock /> سجل المواعيد</button><button onClick={() => onOpenHistory('finance')}><FileText /> سجل الدفعات</button></section>
  </div>;
}

function PackagesTab({ client, packages, onFinance, onStartSession, onOpenHistory }) {
  if (!packages.length) return <DrawerEmpty icon={PackageCheck} title="لا توجد باقة نشطة" text="يمكن مراجعة الباقات المنتهية أو إضافة حجز/خدمة جديدة من دليل العميل." action="عرض سجل الباقات" onAction={() => onOpenHistory('packages')} />;
  return <div className="client-crm-packages">{packages.map((pkg, index) => {
    const quantity = packageQuantitySummary(pkg); const financial = packageFinancialSummary(pkg);
    return <article key={pkg.id || `${pkg.service}-${index}`}><header><div><span>باقة نشطة</span><h3>{pkg.service.replace(' (مؤرشف)', '')}</h3></div>{financial.outstandingCents > 0 ? <StatusPill tone="danger">متبقي {money(centsToMoney(financial.outstandingCents))}</StatusPill> : <StatusPill tone="success">مدفوعة</StatusPill>}</header><dl><div><dt>المتبقي غير المستهلك</dt><dd>{formatPackageQuantity(quantity.remaining,pkg.billing_unit)}</dd></div><div><dt>محجوز قادمًا / متاح جديد</dt><dd>{formatPackageQuantity(quantity.held,pkg.billing_unit)} / {formatPackageQuantity(quantity.available,pkg.billing_unit)}</dd></div><div><dt>المدفوع</dt><dd>{money(centsToMoney(financial.paidCents))}</dd></div><div><dt>الصلاحية</dt><dd>{pkg.expires_at ? `${formatBookingDate(pkg.expires_at)} · ${remainingCalendarDays(pkg.expires_at).toLocaleString('ar-EG-u-nu-latn')} يوم تقويمي` : 'تبدأ عند أول حجز تصوير'}</dd></div></dl><footer>{(quantity.purchased > 0) && <button className="session" onClick={() => onStartSession(client.id, pkg.id)}><Play size={16} /> ابدأ التصوير</button>}{financial.outstandingCents > 0 && <button onClick={() => onFinance('pay_debt')}><WalletCards size={16} /> سداد المتبقي</button>}</footer></article>;
  })}</div>;
}

function BookingsTab({ client, onBook, onOpenCalendar, onOpenHistory }) {
  return <div className="client-crm-focused-tab"><CalendarClock size={32} /><h3>{client.nextBooking ? 'الموعد القادم' : 'لا يوجد موعد قادم'}</h3><p>{client.nextBooking ? `${bookingDate(client.nextBooking)} · ${formatTime12(client.nextBooking.start_time)} — ${formatTime12(client.nextBooking.end_time)} · ${client.nextBooking.service || 'حجز'}` : 'أضف حجزًا جديدًا أو راجع السجل الكامل لهذا العميل.'}</p><div><button className="primary" onClick={onBook}><CalendarPlus /> حجز / إضافة</button><button onClick={onOpenCalendar}><CalendarClock /> فتح التقويم</button><button onClick={() => onOpenHistory('bookings')}><History /> سجل المواعيد</button></div></div>;
}

function FinanceTab({ client, onFinance, onOpenHistory }) {
  return <div className="client-crm-finance"><section className={Number(client.debt) > 0 ? 'danger' : ''}><span>المديونية المباشرة</span><strong>{money(client.debt)}</strong><p>{client.hasPackageDebt ? 'يوجد أيضًا استحقاق مشتق من إحدى الباقات.' : 'لا توجد استحقاقات باقات إضافية ظاهرة.'}</p><button onClick={() => onFinance('pay_debt')}><CircleDollarSign /> سداد مديونية</button></section><section className={Number(client.credit) > 0 ? 'success' : ''}><span>رصيد العميل بالشركة</span><strong>{money(client.credit)}</strong><p>الرصيد الدائن المتاح والمسجل على حساب العميل.</p><button onClick={() => onFinance('deposit')}><WalletCards /> إيداع رصيد</button></section><button className="client-crm-finance-history" onClick={() => onOpenHistory('finance')}><FileText /> عرض سجل الدفعات النقدية</button></div>;
}

function DrawerEmpty({ icon: Icon, title, text, action, onAction }) {
  return <div className="client-crm-drawer-empty"><Icon /><h3>{title}</h3><p>{text}</p>{action && <button onClick={onAction}>{action}</button>}</div>;
}
