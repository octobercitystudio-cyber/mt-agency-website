import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Image, Grid, LogOut, Home, Type, Tag, Sidebar, Menu, X, Search } from 'lucide-react';
import { useData } from '../store/DataContext';
import useExternalScripts from '../hooks/useExternalScripts';
import './AdminLayout.css';

const AdminLayout = () => {
  const { logout } = useData();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  useExternalScripts();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="admin-container" dir="rtl">
      {/* Sidebar */}
      <aside className="admin-sidebar glass-panel">
        <div className="sidebar-header">
          <h2>MT Agency</h2>
          <p>لوحة التحكم</p>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/adminmt/hero" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Type size={20} />
            الرئيسية (Hero)
          </NavLink>
          <NavLink to="/adminmt/about" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <LayoutDashboard size={20} />
            من نحن
          </NavLink>
          <NavLink to="/adminmt/services" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Grid size={20} />
            الخدمات
          </NavLink>
          <NavLink to="/adminmt/portfolio" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Image size={20} />
            معرض الأعمال
          </NavLink>
          <NavLink to="/adminmt/studio" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Image size={20} />
            الاستوديوهات
          </NavLink>
          <NavLink to="/adminmt/contact" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Type size={20} />
            بيانات التواصل
          </NavLink>
          <NavLink to="/adminmt/offers" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Tag size={20} />
            إدارة العروض
          </NavLink>
          <NavLink to="/adminmt/settings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Settings size={20} />
            إعدادات عامة
          </NavLink>
          <NavLink to="/adminmt/seo" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Search size={20} />
            إعدادات الـ SEO
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <a href="/" target="_blank" rel="noopener noreferrer" className="nav-item">
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
        <header className="admin-header glass-panel">
          <h1>مرحباً بك في لوحة التحكم</h1>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
