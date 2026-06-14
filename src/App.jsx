import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UnifiedLogin from './pages/UnifiedLogin';
import ClientDashboard from './pages/ClientDashboard';
import { DataProvider, useData } from './store/DataContext';

// Lazy Load Admin Components
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminLogin = lazy(() => import('./admin/AdminLogin'));
const AdminServices = lazy(() => import('./admin/AdminServices'));
const AdminHero = lazy(() => import('./admin/AdminHero'));
const AdminAbout = lazy(() => import('./admin/AdminAbout'));
const AdminPortfolio = lazy(() => import('./admin/AdminPortfolio'));
const AdminStudio = lazy(() => import('./admin/AdminStudio'));
const AdminContact = lazy(() => import('./admin/AdminContact'));
const AdminOffers = lazy(() => import('./admin/AdminOffers'));
const AdminSettings = lazy(() => import('./admin/AdminSettings'));

// Lazy Load ERP Components
const ERPLayout = lazy(() => import('./erp/ERPLayout'));
const ERPDashboard = lazy(() => import('./erp/ERPDashboard'));
const ERPClients = lazy(() => import('./erp/ERPClients'));
const ERPBookings = lazy(() => import('./erp/ERPBookings'));
const ERPFinance = lazy(() => import('./erp/ERPFinance'));
const ERPSettings = lazy(() => import('./erp/ERPSettings'));
const ERPReminders = lazy(() => import('./erp/ERPReminders'));
const ERPOfferGenerator = lazy(() => import('./erp/ERPOfferGenerator'));

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
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Clear any hash (#portfolio, etc.) from URL on fresh load
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    
    // Force scroll to top with a slight delay to ensure rendering is complete
    window.scrollTo(0, 0);
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 100);
  }, [pathname]);

  return null;
};

function App() {
  useEffect(() => {
    // Disable Right Click
    const handleContextMenu = (e) => e.preventDefault();
    
    // Disable Developer Shortcuts
    const handleKeyDown = (e) => {
      // F12
      if (e.keyCode === 123) {
        e.preventDefault();
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
        e.preventDefault();
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <DataProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0a', color: '#7a28cb' }}>جاري التحميل...</div>}>
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
              <Route index element={<ERPDashboard />} />
              <Route path="clients" element={<ERPClients />} />
              <Route path="bookings" element={<ERPBookings />} />
              <Route path="finance" element={<ERPFinance />} />
              <Route path="settings" element={<ERPSettings />} />
              <Route path="reminders" element={<ERPReminders />} />
              <Route path="offer-generator" element={<ERPOfferGenerator />} />
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
        </Suspense>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
