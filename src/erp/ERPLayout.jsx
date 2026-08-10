import { useCallback, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, DollarSign, LogOut, Home, Menu, LayoutDashboard, ClipboardList, FileText, Settings, Bell, Inbox, Package, FolderKanban, Fingerprint, FlaskConical, RotateCcw, CheckCircle2, AlertCircle, Landmark, TrendingUp } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useGlobalAlerts, NotificationsOffcanvas } from './ERPNotifications';
import { dataClient } from '../dataClient';
import ERPSessionTimer from './ERPSessionTimer';
import useExternalScripts from '../hooks/useExternalScripts';
import useChangeSync from '../hooks/useChangeSync';
import { resetDemoDatabase } from '../lib/demoDataClient';
import './ERPLayout.css';
import './ERPEnterpriseTheme.css';

const ERPLayout = () => {
  const { logoutErp, currentUser } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { alerts, dismissAlert } = useGlobalAlerts();
  const [requestsCount, setRequestsCount] = useState(0);
  const [demoResetState, setDemoResetState] = useState('idle');
  const [demoDataVersion, setDemoDataVersion] = useState(0);

  useExternalScripts();
  
  const unreadCount = alerts.length;
  const role = currentUser?.role;
  const canManageFinance = ['owner', 'admin'].includes(role);
  const canManageFormationFund = ['owner', 'admin'].includes(role);
  const canManageSocialProfits = ['owner', 'admin'].includes(role);
  const canOpenOffers = ['owner', 'admin'].includes(role);
  const canOpenSettings = ['owner', 'admin'].includes(role);
  const canOpenRequests = ['owner', 'admin', 'operations', 'finance'].includes(role);
  const canOpenPackages = ['owner', 'admin', 'operations', 'finance'].includes(role);
  const canOpenProjects = ['owner', 'admin', 'operations', 'staff'].includes(role);
  const canSeeOperationsRequests = ['owner', 'admin', 'operations'].includes(role);
  const canSeeFinanceRequests = ['owner', 'admin', 'finance'].includes(role);

  const refreshRequestsCount = useCallback(async () => {
    if (!canOpenRequests) return setRequestsCount(0);
    const queries = [];
    if (canSeeOperationsRequests) {
      queries.push(dataClient.from('bookings').select('id,status'));
      queries.push(dataClient.from('reschedule_requests').select('id').eq('status', 'pending'));
    }
    if (canSeeFinanceRequests) queries.push(dataClient.from('payment_proofs').select('id').eq('status', 'pending'));
    const results = await Promise.all(queries);
    let total = 0;
    results.forEach((result, index) => {
      if (!result.data) return;
      if (canSeeOperationsRequests && index === 0) total += result.data.filter(item => ['pending', 'cancel_requested', 'late_cancel_requested'].includes(item.status)).length;
      else total += result.data.length;
    });
    setRequestsCount(total);
  }, [canOpenRequests, canSeeFinanceRequests, canSeeOperationsRequests]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshRequestsCount();
    const handler = () => refreshRequestsCount();
    window.addEventListener('erpRequestsUpdated', handler);
    return () => window.removeEventListener('erpRequestsUpdated', handler);
  }, [refreshRequestsCount]);
  useEffect(() => {
    const handleDemoDataReset = () => setDemoDataVersion(version => version + 1);
    window.addEventListener('erpDemoDataReset', handleDemoDataReset);
    return () => window.removeEventListener('erpDemoDataReset', handleDemoDataReset);
  }, []);
  useChangeSync(useCallback((topics) => {
    if (topics.some(topic => ['bookings', 'finance', 'notifications'].includes(topic))) refreshRequestsCount();
  }, [refreshRequestsCount]), !currentUser?.is_local_preview);

  const handleLogout = async () => {
    await logoutErp();
    navigate('/login');
  };

  const handleDemoReset = async () => {
    const confirmed = window.confirm('سيتم حذف كل التغييرات التجريبية واستعادة البيانات الأصلية. هل تريد المتابعة؟');
    if (!confirmed) return;

    setDemoResetState('loading');
    try {
      await resetDemoDatabase();
      setDemoResetState('success');
      window.dispatchEvent(new CustomEvent('erpDemoDataReset', { detail: { topics: ['demo-data'] } }));
    } catch (error) {
      console.error('Unable to reset demo database:', error);
      setDemoResetState('error');
    }
  };

  return (
    <div className="erp-layout">
      {/* Mobile Header */}
      <div className="erp-mobile-header">
        <h4 style={{fontWeight: 'bold', margin: 0, color: 'var(--erp-text-main)'}}>Multi Task <span style={{color: 'var(--erp-primary)'}}>Agency</span></h4>
        <div style={{display: 'flex', gap: '8px'}}>

          <button className="erp-mobile-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={20} color="var(--erp-text-main)" />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Now only toggled via bottom nav "More") */}
      {sidebarOpen && (
        <div className="erp-modal-overlay" onClick={() => setSidebarOpen(false)} style={{zIndex: 1035}}></div>
      )}

      {/* Sidebar */}
      <div className={`erp-sidebar ${sidebarOpen ? 'show' : ''}`}>
        <nav className="erp-nav-menu" aria-label="التنقل الرئيسي">
          <section className="erp-nav-group" aria-labelledby="erp-nav-daily-label">
            <h2 id="erp-nav-daily-label" className="erp-nav-group-label">التشغيل اليومي</h2>
            <ul className="erp-nav-list">
              <li className="erp-nav-item">
                <NavLink to="/erp" end className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <LayoutDashboard size={20} /> لوحة القيادة
                </NavLink>
              </li>
              {canOpenRequests && <li className="erp-nav-item">
                <NavLink to="/erp/requests" className={({isActive}) => `erp-nav-link position-relative ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <Inbox size={20} /> صندوق الطلبات
                  {requestsCount > 0 && <span className="badge rounded-pill bg-danger" style={{marginRight:'auto',fontSize:'.65rem'}}>{requestsCount}</span>}
                </NavLink>
              </li>}
              <li className="erp-nav-item">
                <NavLink to="/erp/clients" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <Users size={20} /> قاعدة العملاء
                </NavLink>
              </li>
              <li className="erp-nav-item">
                <NavLink to="/erp/bookings" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <CalendarDays size={20} /> جدول الحجوزات
                </NavLink>
              </li>
            </ul>
          </section>

          <section className="erp-nav-group" aria-labelledby="erp-nav-work-label">
            <h2 id="erp-nav-work-label" className="erp-nav-group-label">الخدمات والعمل</h2>
            <ul className="erp-nav-list">
              {canOpenPackages && <li className="erp-nav-item">
                <NavLink to="/erp/packages" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <Package size={20} /> الباقات المباعة
                </NavLink>
              </li>}
              {canOpenProjects && <li className="erp-nav-item">
                <NavLink to="/erp/projects" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <FolderKanban size={20} /> المشروعات والمحتوى
                </NavLink>
              </li>}
              <li className="erp-nav-item">
                <NavLink to="/erp/reminders" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <ClipboardList size={20} /> المهام والتذكيرات
                </NavLink>
              </li>
              {canOpenOffers && <li className="erp-nav-item">
                <NavLink to="/erp/offers" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <FileText size={20} /> إنشاء عرض
                </NavLink>
              </li>}
            </ul>
          </section>

          <section className="erp-nav-group" aria-labelledby="erp-nav-finance-label">
            <h2 id="erp-nav-finance-label" className="erp-nav-group-label">المالية والفريق</h2>
            <ul className="erp-nav-list">
              <li className="erp-nav-item">
                <NavLink to="/erp/attendance" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <Fingerprint size={20} /> الحضور والرواتب
                </NavLink>
              </li>
              {canManageFinance && <li className="erp-nav-item">
                <NavLink to="/erp/finance" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <DollarSign size={20} /> الخزينة والحسابات
                </NavLink>
              </li>}
              {canManageFormationFund && <li className="erp-nav-item erp-nav-item--formation">
                <NavLink to="/erp/formation-fund" className={({isActive}) => `erp-nav-link erp-nav-link--formation ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <Landmark size={20} /> صندوق التأسيس
                </NavLink>
              </li>}
              {canManageSocialProfits && <li className="erp-nav-item erp-nav-item--social-profits">
                <NavLink to="/erp/social-profits" className={({isActive}) => `erp-nav-link erp-nav-link--social-profits ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <TrendingUp size={20} /> أرباح السوشيال
                </NavLink>
              </li>}
            </ul>
          </section>
        </nav>

        <section className="erp-sidebar-actions" aria-labelledby="erp-nav-system-label">
          <h2 id="erp-nav-system-label" className="erp-nav-group-label">النظام</h2>
          <div className="erp-nav-item mb-1">
            <button className="erp-nav-link erp-nav-alert-btn position-relative" onClick={() => setNotificationsOpen(true)} style={{width: '100%', border: '1px solid rgba(255, 152, 0, 0.2)', background: 'rgba(255, 193, 7, 0.1)', color: '#ff9800', justifyContent: 'flex-start'}}>
              <Bell size={20} style={{color: '#ff9800'}} /> مركز الإشعارات
              {unreadCount > 0 && (
                <span className="position-absolute top-50 translate-middle-y badge rounded-pill bg-danger" style={{left: '15px'}}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
          {canOpenSettings && <div className="erp-nav-item mb-1">
            <NavLink to="/erp/settings" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Settings size={20} /> إعدادات النظام
            </NavLink>
          </div>}
          <a href="/" target="_blank" rel="noopener noreferrer" className="erp-nav-link mb-2" style={{color: 'var(--erp-text-muted)'}}>
            <Home size={20} /> عرض الموقع
          </a>
          <button onClick={handleLogout} className="erp-nav-link" style={{width: '100%', color: '#ef4444', background: 'transparent', border: 'none', justifyContent: 'flex-start'}}>
            <LogOut size={20} style={{color: '#ef4444'}} /> تسجيل الخروج
          </button>
        </section>
      </div>

      {/* Main Content Area */}
      <div className="erp-main" style={{marginTop: '0'}}>
        {currentUser?.is_local_preview && (
          <aside className={`erp-demo-banner erp-demo-banner--${demoResetState}`} aria-label="تنبيه وضع التجربة">
            <div className="erp-demo-banner__status" aria-hidden="true">
              <span className="erp-demo-banner__pulse" />
              {demoResetState === 'success'
                ? <CheckCircle2 />
                : demoResetState === 'error'
                  ? <AlertCircle />
                  : <FlaskConical />}
            </div>
            <div className="erp-demo-banner__copy" aria-live="polite">
              <strong>وضع التجربة</strong>
              <p>
                {demoResetState === 'success' && 'تمت إعادة بيانات التجربة الأصلية بنجاح.'}
                {demoResetState === 'error' && 'تعذرت إعادة البيانات. حاول مرة أخرى.'}
                {(demoResetState === 'idle' || demoResetState === 'loading') && 'هذه السجلات وهمية، وتظل تغييراتك على هذا الجهاز فقط.'}
              </p>
            </div>
            <button
              type="button"
              className="erp-demo-banner__reset"
              onClick={handleDemoReset}
              disabled={demoResetState === 'loading'}
            >
              <RotateCcw className={demoResetState === 'loading' ? 'is-spinning' : ''} />
              <span>{demoResetState === 'loading' ? 'جارٍ الاستعادة...' : 'إعادة ضبط البيانات'}</span>
            </button>
          </aside>
        )}
        <Outlet key={demoDataVersion} />
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="erp-bottom-nav">
        <NavLink to="/erp" end className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <LayoutDashboard size={22} />
          الرئيسية
        </NavLink>
        <NavLink to="/erp/clients" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <Users size={22} />
          العملاء
        </NavLink>
        <NavLink to="/erp/bookings" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <CalendarDays size={22} />
          الحجوزات
        </NavLink>
        <NavLink to="/erp/attendance" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <Fingerprint size={22} />
          الحضور
        </NavLink>
        {canOpenRequests && <NavLink to="/erp/requests" className={({isActive}) => `erp-bottom-nav-item position-relative ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <Inbox size={22} />
          الطلبات
          {requestsCount > 0 && <span className="position-absolute badge rounded-pill bg-danger" style={{top:'2px',left:'calc(50% - 20px)',fontSize:'.55rem'}}>{requestsCount}</span>}
        </NavLink>}
        {canOpenPackages && <NavLink to="/erp/packages" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <Package size={22} />
          الباقات
        </NavLink>}
        {canOpenProjects && <NavLink to="/erp/projects" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <FolderKanban size={22} />
          المشروعات
        </NavLink>}
        {canManageFinance && <NavLink to="/erp/finance" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <DollarSign size={22} />
          الحسابات
        </NavLink>}
        <button type="button" className={`erp-bottom-nav-item erp-bottom-nav-more ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu size={22} />
          المزيد
        </button>
      </div>

      <NotificationsOffcanvas 
        isOpen={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
        alerts={alerts} 
        onDismiss={dismissAlert} 
      />

      {/* Global Session Timer */}
      <ERPSessionTimer role={role} />
    </div>
  );
};

export default ERPLayout;
