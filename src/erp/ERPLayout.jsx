import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, DollarSign, LogOut, Home, User, Menu, LayoutDashboard } from 'lucide-react';
import { useData } from '../store/DataContext';
import './ERPLayout.css';

const ERPLayout = () => {
  const { logoutErp } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logoutErp();
    navigate('/login');
  };

  return (
    <div className="erp-layout">

      {/* Sidebar Overlay */}
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
        </nav>

        <div style={{marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(0,0,0,0.03)'}}>
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
    </div>
  );
};

export default ERPLayout;
