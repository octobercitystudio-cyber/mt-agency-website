import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, DollarSign, LogOut, Home, User, Menu, LayoutDashboard, ClipboardList, FileText, Settings, Bell, RotateCcw } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useGlobalAlerts, NotificationsOffcanvas } from './ERPNotifications';
import { supabase } from '../supabaseClient';
import './ERPLayout.css';

const ERPLayout = () => {
  const { logoutErp } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { alerts, dismissAlert } = useGlobalAlerts();
  const [isUndoing, setIsUndoing] = useState(false);
  
  const unreadCount = alerts.length;

  const handleUndo = async () => {
    if (isUndoing) return;
    setIsUndoing(true);
    try {
      const { data, error } = await supabase.rpc('undo_last_action');
      if (error) {
        console.error('Undo error:', error);
        alert('حدث خطأ أثناء محاولة التراجع.');
      } else if (data && data.success) {
        alert(data.message);
        // Reload page to reflect changes instantly across all components
        window.location.reload();
      } else {
        alert(data?.message || 'لا يوجد عمليات أخرى للتراجع عنها!');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ بالاتصال.');
    } finally {
      setIsUndoing(false);
    }
  };

  const handleLogout = () => {
    logoutErp();
    navigate('/login');
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
        <div className="erp-brand-container d-none d-lg-block" style={{display: sidebarOpen ? 'block' : ''}}>
          <h3 style={{color: 'var(--erp-primary)', fontWeight: 'bold', margin: 0}}>Multi Task<br/><span style={{fontSize: '1.2rem', color: 'var(--erp-text-main)'}}>Agency</span></h3>
        </div>

        <div className="erp-user-card" style={{marginTop: '20px'}}>
          <div className="erp-user-avatar">
            <User size={24} />
          </div>
          <div>
            <h6 style={{margin: 0, fontWeight: 800, fontSize: '0.95rem', color: 'var(--erp-text-main)'}}>إدارة الشركة</h6>
            <span style={{fontSize: '0.70rem', fontWeight: 700, padding: '2px 8px', background: '#ef4444', color: 'white', borderRadius: '50px'}}>مدير النظام</span>
          </div>
        </div>

        <nav className="erp-nav-menu">
          <li className="erp-nav-item">
            <NavLink to="/erp" end className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <LayoutDashboard size={20} /> لوحة القيادة
            </NavLink>
          </li>
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
          <li className="erp-nav-item">
            <NavLink to="/erp/finance" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <DollarSign size={20} /> الخزينة والحسابات
            </NavLink>
          </li>
          <li className="erp-nav-item">
            <NavLink to="/erp/reminders" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <ClipboardList size={20} /> المهام والتذكيرات
            </NavLink>
          </li>
          <li className="erp-nav-item">
            <NavLink to="/erp/offer-generator" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <FileText size={20} /> إنشاء عرض سعر
            </NavLink>
          </li>
        </nav>

        <div style={{marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(0,0,0,0.03)'}}>
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
          <div className="erp-nav-item mb-1">
            <NavLink to="/erp/settings" className={({isActive}) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Settings size={20} /> إعدادات النظام
            </NavLink>
          </div>
          <a href="/" target="_blank" className="erp-nav-link mb-2" style={{color: 'var(--erp-text-muted)'}}>
            <Home size={20} /> عرض الموقع
          </a>
          <button onClick={handleLogout} className="erp-nav-link" style={{width: '100%', color: '#ef4444', background: 'transparent', border: 'none', justifyContent: 'flex-start'}}>
            <LogOut size={20} style={{color: '#ef4444'}} /> تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="erp-main" style={{marginTop: '0'}}>
        <Outlet />
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
        <NavLink to="/erp/finance" className={({isActive}) => `erp-bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <DollarSign size={22} />
          الحسابات
        </NavLink>
        <div className={`erp-bottom-nav-item ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)} style={{cursor: 'pointer'}}>
          <Menu size={22} />
          المزيد
        </div>
      </div>

      <NotificationsOffcanvas 
        isOpen={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
        alerts={alerts} 
        onDismiss={dismissAlert} 
      />

      {/* Floating Undo Button */}
      <button 
        onClick={handleUndo} 
        disabled={isUndoing}
        className="btn shadow erp-floating-undo" 
      >
        <RotateCcw size={20} className={isUndoing ? "fa-spin" : ""} />
        {isUndoing ? 'جاري التراجع...' : 'تراجع عن آخر خطوة'}
      </button>
    </div>
  );
};

export default ERPLayout;
