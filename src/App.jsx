import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import HomePage from './pages/HomePage';
import { DataProvider, useData } from './store/DataContext';
import PublicLayout from './layouts/PublicLayout';

const ERP_ROLES = ['owner', 'admin', 'operations', 'finance', 'staff'];

const PrivateSurface = ({ children }) => <><Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>{children}</>;

const UnifiedLogin = lazy(() => import('./pages/UnifiedLogin'));
const ForcedPasswordChange = lazy(() => import('./pages/ForcedPasswordChange'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ERPLayout = lazy(() => import('./erp/ERPLayout'));
const ERPDashboard = lazy(() => import('./erp/ERPDashboard'));
const loadPublicPages = () => import('./pages/PublicPages');
const ServicesIndexPage = lazy(() => loadPublicPages().then((module) => ({ default: module.ServicesIndexPage })));
const ServiceDetailPage = lazy(() => loadPublicPages().then((module) => ({ default: module.ServiceDetailPage })));
const AboutPage = lazy(() => loadPublicPages().then((module) => ({ default: module.AboutPage })));
const PortfolioPage = lazy(() => loadPublicPages().then((module) => ({ default: module.PortfolioPage })));
const StudiosPage = lazy(() => loadPublicPages().then((module) => ({ default: module.StudiosPage })));
const ContactPage = lazy(() => loadPublicPages().then((module) => ({ default: module.ContactPage })));
const PublicNotFound = lazy(() => loadPublicPages().then((module) => ({ default: module.PublicNotFound })));

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
const AdminSEO = lazy(() => import('./admin/AdminSEO'));

// Lazy Load ERP Components
const ERPClients = lazy(() => import('./erp/ERPClients'));
const ERPBookings = lazy(() => import('./erp/ERPBookings'));
const ERPFinance = lazy(() => import('./erp/ERPFinance'));
const ERPFormationFund = lazy(() => import('./erp/ERPFormationFund'));
const ERPSocialProfits = lazy(() => import('./erp/ERPSocialProfits'));
const ERPSettings = lazy(() => import('./erp/ERPSettings'));
const ERPReminders = lazy(() => import('./erp/ERPReminders'));
const ERPOfferGenerator = lazy(() => import('./erp/ERPOfferGenerator'));
const ERPPromotions = lazy(() => import('./erp/ERPPromotions'));
const ERPRequests = lazy(() => import('./erp/ERPRequests'));
const ERPPackages = lazy(() => import('./erp/ERPPackages'));
const ERPProjects = lazy(() => import('./erp/ERPProjects'));
const ERPAttendance = lazy(() => import('./erp/ERPAttendance'));

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useData();
  if (!['owner', 'admin'].includes(currentUser?.role)) return <Navigate to="/adminmt/login" replace />;
  return children;
};

const ErpProtectedRoute = ({ children }) => {
  const { currentUser } = useData();
  if (!ERP_ROLES.includes(currentUser?.role)) return <Navigate to="/login" replace />;
  return children;
};

const ClientProtectedRoute = ({ children }) => {
  const { currentUser } = useData();
  if (currentUser?.role !== 'client') return <Navigate to="/login" replace />;
  if (currentUser.must_change_password) return <Navigate to="/change-password" replace />;
  return children;
};

const ForcedPasswordRoute = ({ children }) => {
  const { currentUser } = useData();
  if (currentUser?.role !== 'client') return <Navigate to="/login" replace />;
  if (!currentUser.must_change_password) return <Navigate to="/dashboard" replace />;
  return children;
};

const RoleProtectedRoute = ({ roles, children }) => {
  const { currentUser } = useData();
  if (!currentUser || !roles.includes(currentUser.role)) return <Navigate to="/erp" replace />;
  return children;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    if (pathname === '/' && window.location.hash) return undefined;
    window.scrollTo(0, 0);
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 100);
    return undefined;
  }, [pathname]);

  // Listen to hash changes (e.g. mobile back button returning to empty hash)
  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash || window.location.hash === '#home') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return null;
};

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0a', color: '#7a28cb' }}>جاري التحميل...</div>}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="services" element={<ServicesIndexPage />} />
              <Route path="services/:slug" element={<ServiceDetailPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="studios" element={<StudiosPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="*" element={<PublicNotFound />} />
            </Route>
            <Route path="/login" element={<PrivateSurface><UnifiedLogin /></PrivateSurface>} />
            <Route path="/change-password" element={<PrivateSurface><ForcedPasswordRoute><ForcedPasswordChange /></ForcedPasswordRoute></PrivateSurface>} />
            <Route path="/dashboard" element={<PrivateSurface><ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute></PrivateSurface>} />
            <Route path="/adminmt/login" element={<PrivateSurface><AdminLogin /></PrivateSurface>} />
            <Route 
              path="/erp/*" 
              element={
                <PrivateSurface><ErpProtectedRoute>
                  <ERPLayout />
                </ErpProtectedRoute></PrivateSurface>
              }
            >
              <Route index element={<ERPDashboard />} />
              <Route path="clients" element={<ERPClients />} />
              <Route path="bookings" element={<ERPBookings />} />
              <Route path="attendance" element={<RoleProtectedRoute roles={['owner', 'admin', 'operations', 'finance', 'staff']}><ERPAttendance /></RoleProtectedRoute>} />
              <Route path="requests" element={<RoleProtectedRoute roles={['owner', 'admin', 'operations', 'finance']}><ERPRequests /></RoleProtectedRoute>} />
              <Route path="packages" element={<RoleProtectedRoute roles={['owner', 'admin', 'operations', 'finance']}><ERPPackages /></RoleProtectedRoute>} />
              <Route path="projects" element={<RoleProtectedRoute roles={['owner', 'admin', 'operations', 'staff']}><ERPProjects /></RoleProtectedRoute>} />
              <Route path="finance" element={<RoleProtectedRoute roles={['owner', 'admin']}><ERPFinance /></RoleProtectedRoute>} />
              <Route path="formation-fund" element={<RoleProtectedRoute roles={['owner', 'admin']}><ERPFormationFund /></RoleProtectedRoute>} />
              <Route path="social-profits" element={<RoleProtectedRoute roles={['owner', 'admin']}><ERPSocialProfits /></RoleProtectedRoute>} />
              <Route path="settings" element={<RoleProtectedRoute roles={['owner', 'admin']}><ERPSettings /></RoleProtectedRoute>} />
              <Route path="reminders" element={<ERPReminders />} />
              <Route path="offer-generator" element={<RoleProtectedRoute roles={['owner', 'admin', 'operations', 'finance']}><ERPOfferGenerator /></RoleProtectedRoute>} />
              <Route path="offers" element={<RoleProtectedRoute roles={['owner', 'admin']}><ERPPromotions /></RoleProtectedRoute>} />
            </Route>
            <Route 
              path="/adminmt/*" 
              element={
                <PrivateSurface><ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute></PrivateSurface>
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
              <Route path="seo" element={<AdminSEO />} />
              <Route path="*" element={<div style={{padding: '2rem'}}>قريباً سيتم إضافة هذه الصفحة...</div>} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
