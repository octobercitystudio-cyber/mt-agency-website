import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AdminLayout from './admin/AdminLayout';
import AdminLogin from './admin/AdminLogin';
import AdminServices from './admin/AdminServices';
import AdminHero from './admin/AdminHero';
import AdminAbout from './admin/AdminAbout';
import AdminPortfolio from './admin/AdminPortfolio';
import AdminStudio from './admin/AdminStudio';
import AdminContact from './admin/AdminContact';
import { DataProvider, useData } from './store/DataContext';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAdminAuth } = useData();
  if (!isAdminAuth) return <Navigate to="/adminmt/login" replace />;
  return children;
};

function App() {
  useEffect(() => {
    // Prevent browser from restoring previous scroll position
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Clear any hash (#portfolio, etc.) from URL on fresh load
    // so the browser doesn't automatically jump down
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    
    // Force scroll to top (with slight delay to outrun browser's native jump)
    window.scrollTo(0, 0);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
  }, []);

  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/adminmt/login" element={<AdminLogin />} />
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
            <Route path="*" element={<div style={{padding: '2rem'}}>قريباً سيتم إضافة هذه الصفحة...</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
