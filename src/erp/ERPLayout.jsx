import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, DollarSign, LogOut, Home, Settings } from 'lucide-react';
import { useData } from '../store/DataContext';
import '../admin/AdminLayout.css'; // Reuse some layout styles

const ERPLayout = () => {
  const { logoutErp } = useData();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutErp();
    navigate('/login');
  };

  return (
    <div className="admin-container" dir="rtl">
      {/* Sidebar */}
      <aside className="admin-sidebar glass-panel">
        <div className="sidebar-header" style={{ borderBottom: '1px solid rgba(157, 78, 221, 0.3)' }}>
          <h2>MT ERP</h2>
          <p>إدارة الشركة</p>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/erp/clients" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Users size={20} />
            العملاء
          </NavLink>
          <NavLink to="/erp/bookings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <CalendarDays size={20} />
            المواعيد والحجوزات
          </NavLink>
          <NavLink to="/erp/finance" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <DollarSign size={20} />
            الحسابات المالية
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <a href="/" target="_blank" className="nav-item">
            <Home size={20} />
            عرض الموقع
          </a>
          <button onClick={handleLogout} className="nav-item logout-btn">
            <LogOut size={20} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header glass-panel" style={{ background: 'rgba(25, 25, 25, 0.9)' }}>
          <h1>نظام الإدارة الشامل (ERP)</h1>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ERPLayout;
