import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, DollarSign, LogOut, Home, User, Menu, LayoutDashboard } from 'lucide-react';
import { useData } from '../store/DataContext';
import '../admin/AdminLayout.css';

const ERPLayout = () => {
  const { logoutErp } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logoutErp();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      {/* Mobile Toggle Button */}
      <div className="admin-mobile-header d-lg-none" style={{display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'var(--bg-dark)', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100%', position: 'fixed', top: 0, zIndex: 1030}}>
        <div style={{fontWeight: 'bold', fontSize: '1.2rem', color: '#fff'}}>
          MT <span style={{color: 'var(--color-vibrant-purple)'}}>Agency</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{background: 'transparent', border: 'none', color: '#fff'}}>
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} style={{zIndex: 1035}}></div>
      )}

      {/* Sidebar */}
      <div className={`admin-sidebar glass-panel ${sidebarOpen ? 'show' : ''}`} style={{zIndex: 1040}}>
        <div className="brand-logo d-none d-lg-block" style={{textAlign: 'center', marginBottom: '20px'}}>
          <h2 style={{color: 'var(--color-vibrant-purple)', fontWeight: 'bold', margin: 0}}>Multi Task<br/><span style={{fontSize: '1.2rem', color: '#fff'}}>Agency</span></h2>
        </div>

        <div className="admin-card" style={{marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px'}}>
          <div style={{width: '45px', height: '45px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--color-vibrant-purple) 0%, #ff4d94 100%)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <User size={24} />
          </div>
          <div>
            <h6 style={{margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#fff'}}>إدارة الشركة</h6>
            <span style={{fontSize: '0.70rem', fontWeight: 700, padding: '2px 8px', background: '#ef4444', color: 'white', borderRadius: '50px'}}>مدير النظام</span>
          </div>
        </div>

        <nav className="admin-nav">
          <ul>
            <li>
              <NavLink to="/erp" end className={({isActive}) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
                <LayoutDashboard size={20} /> لوحة القيادة
              </NavLink>
            </li>
            <li>
              <NavLink to="/erp/clients" className={({isActive}) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
                <Users size={20} /> قاعدة العملاء
              </NavLink>
            </li>
            <li>
              <NavLink to="/erp/bookings" className={({isActive}) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
                <CalendarDays size={20} /> جدول الحجوزات
              </NavLink>
            </li>
            <li>
              <NavLink to="/erp/finance" className={({isActive}) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
                <DollarSign size={20} /> الحسابات المالية
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="admin-sidebar-footer" style={{marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
          <a href="/" target="_blank" className="btn-modern-secondary w-100 mb-2" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none'}}>
            <Home size={18} /> عرض الموقع
          </a>
          <button onClick={handleLogout} className="btn-modern-secondary w-100" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)'}}>
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-main" style={{marginTop: sidebarOpen ? '60px' : '0'}}>
        <Outlet />
      </div>
    </div>
  );
};

export default ERPLayout;
