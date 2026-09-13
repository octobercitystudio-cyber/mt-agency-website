import { AlertTriangle, Bell, Calendar, CheckCircle, Clock, DollarSign, FolderKanban, Package, RotateCw, X } from 'lucide-react';
import { formatBookingDate, formatDateTime12, formatPackageQuantity } from '../lib/businessFormat';

const alertIcon = alert => {
  if (['package_payment_due', 'package_payment_upcoming'].includes(alert.type)) return <DollarSign size={19} />;
  if (['package_balance_low', 'package_exhausted', 'package_fully_booked'].includes(alert.type)) return <Clock size={19} />;
  if (alert.type === 'project_task') return <FolderKanban size={19} />;
  if (alert.type === 'delivery') return <Calendar size={19} />;
  if (alert.type === 'reminder') return <AlertTriangle size={19} />;
  return <Package size={19} />;
};

const severityClass = severity => ({ danger: 'danger', warning: 'warning', success: 'success', info: 'primary' })[severity] || 'primary';
const formatAlertDue = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? formatBookingDate(value) : formatDateTime12(value, String(value || '').slice(0, 10));

export const NotificationsOffcanvas = ({ isOpen, onClose, alerts, loading, error, onRefresh, onDismiss, onOpen }) => (
  <>
    {isOpen && <div className="offcanvas-backdrop fade show" onClick={onClose} style={{ zIndex: 1040 }} />}
    <aside className={`offcanvas offcanvas-end ${isOpen ? 'show' : ''}`} tabIndex="-1" aria-label="التنبيهات التشغيلية" style={{ zIndex: 1045, width: 'min(440px, 100vw)', visibility: isOpen ? 'visible' : undefined }}>
      <div className="offcanvas-header bg-dark text-white border-bottom p-4">
        <div>
          <h5 className="offcanvas-title fw-bold m-0 d-flex align-items-center gap-2"><Bell className="text-warning" size={24} /> التنبيهات التشغيلية</h5>
          <small className="text-white-50">بيانات مباشرة من الباقات والمهام والمواعيد</small>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-light rounded-circle p-2" onClick={onRefresh} title="تحديث" aria-label="تحديث التنبيهات"><RotateCw size={16} className={loading ? 'spin' : ''} /></button>
          <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="إغلاق" />
        </div>
      </div>
      <div className="offcanvas-body p-0" style={{ background: '#f8fafc', direction: 'rtl' }}>
        {error && <div className="alert alert-danger m-3 rounded-3 d-flex align-items-center gap-2"><AlertTriangle size={18} />{error}</div>}
        {loading && alerts.length === 0 ? (
          <div className="text-center py-5 text-muted"><div className="spinner-border text-primary mb-3" role="status" /><p>جارٍ مراجعة البيانات…</p></div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-5 px-3">
            <CheckCircle size={50} style={{ color: '#10b981', opacity: 0.55, marginBottom: 15 }} />
            <h5 className="fw-bold text-muted">لا توجد تنبيهات حالية</h5>
            <p className="text-muted mb-0">تمت مراجعة الباقات والمهام والتذكيرات والتسليمات.</p>
          </div>
        ) : (
          <div className="list-group list-group-flush">
            {alerts.map(alert => {
              const color = severityClass(alert.severity);
              return <article key={alert.id} className="list-group-item p-3 border-bottom position-relative bg-white operational-alert">
                <button type="button" onClick={() => onDismiss(alert.id)} className="btn btn-sm btn-link position-absolute top-0 end-0 mt-2 me-2 text-muted p-1 dismiss-alert" title="إخفاء هذا التنبيه" aria-label="إخفاء هذا التنبيه"><X size={16} /></button>
                <div className="d-flex gap-3">
                  <span className={`operational-alert__icon text-${color} bg-${color}-subtle`}>{alertIcon(alert)}</span>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <h6 className="fw-bold mb-1 text-dark pe-4">{alert.title}</h6>
                    <p className="mb-2 text-muted small lh-lg">{alert.message}</p>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {alert.client_name && <span className="badge rounded-pill text-bg-light border">العميل: {alert.client_name}</span>}
                      {alert.package_name && <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle">الباقة: {alert.package_name}</span>}
                      {alert.available_quantity !== null && <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle">المتاح: {formatPackageQuantity(alert.available_quantity, alert.billing_unit)}</span>}
                      {alert.project_name && <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle">المشروع: {alert.project_name}</span>}
                    </div>
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      {alert.due_at ? <small className={`fw-bold text-${color}`}>{formatAlertDue(alert.due_at)}</small> : <span />}
                      {alert.action_tab && <button type="button" className={`btn btn-sm btn-outline-${color} rounded-pill px-3 fw-bold`} onClick={() => onOpen(alert)}>فتح التفاصيل</button>}
                    </div>
                  </div>
                </div>
              </article>;
            })}
          </div>
        )}
      </div>
      <style>{`
        .operational-alert:hover { background: #f8fafc !important; }
        .operational-alert__icon { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px; display: grid; place-items: center; }
        .dismiss-alert:hover { color: #ef4444 !important; background: rgba(239,68,68,.1); border-radius: 6px; }
        .spin { animation: operational-alert-spin .8s linear infinite; }
        @keyframes operational-alert-spin { to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  </>
);
