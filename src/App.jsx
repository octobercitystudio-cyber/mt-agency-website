import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UnifiedLogin from './pages/UnifiedLogin';
import AdminLayout from './admin/AdminLayout';
import AdminLogin from './admin/AdminLogin';
import AdminServices from './admin/AdminServices';
import ERPLayout from './erp/ERPLayout';
import ERPClients from './erp/ERPClients';
import ERPBookings from './erp/ERPBookings';
import ERPFinance from './erp/ERPFinance';
import AdminHero from './admin/AdminHero';
import AdminAbout from './admin/AdminAbout';
import AdminPortfolio from './admin/AdminPortfolio';
import AdminStudio from './admin/AdminStudio';
import AdminContact from './admin/AdminContact';
import AdminOffers from './admin/AdminOffers';
import AdminSettings from './admin/AdminSettings';
import ClientDashboard from './pages/ClientDashboard';
import { DataProvider, useData } from './store/DataContext';
import { useLocation } from 'react-router-dom';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAdminAuth } = useData();
  if (!isAdminAuth) return <Navigate to="/adminmt/login" replace />;
  return children;
};

const ErpProtectedRoute = ({ children }) => {
  const { isErpAuth } = useData();
  if (!isErpAuth) return <Navigate to="/login" replace />;
  return children;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Clear any hash (#portfolio, etc.) from URL on fresh load
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<UnifiedLogin />} />
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/adminmt/login" element={<AdminLogin />} />
          <Route 
            path="/erp/*" 
            element={
              <ErpProtectedRoute>
                <ERPLayout />
              </ErpProtectedRoute>
            }
          >
            <Route index element={<Navigate to="clients" replace />} />
            <Route path="clients" element={<ERPClients />} />
            <Route path="bookings" element={<ERPBookings />} />
            <Route path="finance" element={<ERPFinance />} />
          </Route>
          <Route 
            path="/adminmt/*" 
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="hero" replace />} />
            <Route path="hero" element={<AdminHero />} />
            <Route path="about" element={<AdminAbout />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="portfolio" element={<AdminPortfolio />} />
            <Route path="studio" element={<AdminStudio />} />
            <Route path="contact" element={<AdminContact />} />
            <Route path="offers" element={<AdminOffers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="*" element={<div style={{padding: '2rem'}}>قريباً سيتم إضافة هذه الصفحة...</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
