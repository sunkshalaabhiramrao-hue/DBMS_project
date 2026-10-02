import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Car, CalendarDays, CreditCard, GitCompare, ShieldCheck, UserRound, LogOut, Menu, X } from 'lucide-react';
import Registration from './screens/Registration';
import Login from './screens/Login';
import LicenseVerification from './screens/LicenseVerification';
import VehicleCatalog from './screens/VehicleCatalog';
import BookingCheckout from './screens/BookingCheckout';
import DamageAndFuelLog from './components/DamageAndFuelLog';
import Bookings from './screens/Bookings';
import Profile from './screens/Profile';
import Comparison from './screens/Comparison';
import AdminLogin from './screens/AdminLogin';
import AdminDashboard from './screens/AdminDashboard';
import { ComparisonProvider } from './context/ComparisonProvider';
import { PageStateProvider } from './context/PageStateProvider';
import { useResetPageState } from './context/usePageState';
import { getLicenseVerification } from './services/api';
import './App.css';

function clearCustomerSession() {
  localStorage.removeItem('rentalToken');
  localStorage.removeItem('rentalUser');
}

function Navigation({ sidebarOpen, onToggleSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = Boolean(localStorage.getItem('rentalToken'));
  const resetPageState = useResetPageState();
  const [licenseApproved, setLicenseApproved] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      setLicenseApproved(false);
      return undefined;
    }

    let active = true;
    getLicenseVerification()
      .then(({ data }) => {
        if (active) setLicenseApproved(Boolean(data.verified));
      })
      .catch(() => {
        if (active) setLicenseApproved(false);
      });

    return () => { active = false; };
  }, [signedIn, location.pathname]);

  const navigationItems = [
    { label: 'Vehicle catalog', to: '/catalog', icon: Car },
    { label: 'My bookings', to: '/bookings', icon: CalendarDays },
    { label: 'Compare cars', to: '/compare', icon: GitCompare },
    { label: 'Verify license', to: '/license-verification', icon: ShieldCheck },
    ...(licenseApproved ? [{ label: 'Make payment', to: '/license-verification', icon: CreditCard }] : []),
    { label: 'Profile', to: '/profile', icon: UserRound }
  ];
  const hideBack = ['/', '/login', '/register'].includes(location.pathname);
  const fallbackPath = signedIn
    ? location.pathname === '/catalog' ? '/bookings' : '/catalog'
    : location.pathname === '/login' ? '/register' : '/login';
  const navigateBack = () => {
    const historyIndex = window.history.state?.idx;
    if (Number.isInteger(historyIndex) && historyIndex > 0) navigate(-1);
    else navigate(fallbackPath, { replace: true });
  };
  const signOut = () => {
    clearCustomerSession();
    resetPageState();
    navigate('/login', { replace: true });
  };

  if (location.pathname.startsWith('/admin')) {
    const adminSignedIn = Boolean(sessionStorage.getItem('rentalAdminToken'));
    const adminSignOut = () => {
      sessionStorage.removeItem('rentalAdminToken');
      navigate('/admin/login', { replace: true });
    };

    return <header className="public-nav">
      <Link to="/register" className="sidebar-brand"><strong>DRIVEIN</strong><span>FLEET</span></Link>
      <nav className="public-nav-links" aria-label="Account navigation">
        <Link to="/login" className="public-nav-link">Login</Link>
        <Link to="/register" className="public-nav-link">Register</Link>
        <Link to={adminSignedIn ? '/admin' : '/admin/login'} className="public-nav-link is-active" aria-current="page">Admin</Link>
      </nav>
      {adminSignedIn && <button type="button" onClick={adminSignOut} className="admin-nav-signout"><LogOut size={16} /> Sign out</button>}
    </header>;
  }

  if (!signedIn) {
    return <header className="public-nav">
      <Link to="/register" className="sidebar-brand"><strong>DRIVEIN</strong><span>FLEET</span></Link>
      <nav className="public-nav-links" aria-label="Account navigation">
        <Link to="/login" className={location.pathname === '/login' ? 'public-nav-link is-active' : 'public-nav-link'}>Login</Link>
        <Link to="/register" className={location.pathname === '/register' || location.pathname === '/' ? 'public-nav-link is-active' : 'public-nav-link'}>Register</Link>
        <Link to="/admin/login" className="public-nav-link">Admin</Link>
      </nav>
    </header>;
  }

  return <aside className={sidebarOpen ? 'app-sidebar is-open' : 'app-sidebar is-closed'}>
    <div className="sidebar-top">
      <button type="button" onClick={onToggleSidebar} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} aria-expanded={sidebarOpen} title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} className="sidebar-toggle">
        {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
      </button>
      <Link to="/catalog" className="sidebar-brand"><strong>DRIVEIN</strong><span>FLEET</span></Link>
      {!hideBack && <button type="button" onClick={navigateBack} aria-label="Go back" title="Back" className="sidebar-back"><ArrowLeft size={19} /></button>}
    </div>
    <nav className="sidebar-links" aria-label="Main navigation">
      {navigationItems.map(({ label, to, icon: Icon }) => {
        const isActive = location.pathname === to || (to === '/catalog' && location.pathname.startsWith('/checkout/'));
        return <Link key={to} to={to} className={isActive ? 'sidebar-link is-active' : 'sidebar-link'} aria-current={isActive ? 'page' : undefined}>
          <Icon size={18} aria-hidden="true" /><span>{label}</span>
        </Link>;
      })}
    </nav>
    <div className="sidebar-footer">
      <button type="button" onClick={signOut} className="sidebar-signout" title="Sign out"><LogOut size={17} /><span>Sign out</span></button>
    </div>
  </aside>;
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const signedIn = Boolean(localStorage.getItem('rentalToken'));

  return signedIn ? children : <Navigate to="/login" replace state={{ from: location.pathname, fromState: location.state }} />;
}

function AdminRoute({ children }) {
  const location = useLocation();
  const adminToken = sessionStorage.getItem('rentalAdminToken');
  const customerToken = localStorage.getItem('rentalToken');
  if (adminToken) return children;
  if (customerToken) return <Navigate to="/catalog" replace />;
  return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
}

function AdminLoginRoute() {
  const adminToken = sessionStorage.getItem('rentalAdminToken');
  const customerToken = localStorage.getItem('rentalToken');
  if (adminToken) return <Navigate to="/admin" replace />;
  if (customerToken) return <Navigate to="/catalog" replace />;
  return <AdminLogin />;
}

function AppLayout() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const signedIn = !isAdminRoute && Boolean(localStorage.getItem('rentalToken'));
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const frameClass = signedIn
    ? `app-frame app-frame-authenticated ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`
    : 'app-frame app-frame-public';

  useEffect(() => {
    if (!location.pathname.startsWith('/admin') && ['/', '/login', '/register'].includes(location.pathname)) {
      const token = localStorage.getItem('rentalToken');
      const user = localStorage.getItem('rentalUser');
      if (token || user) {
        clearCustomerSession();
      }
    }
  }, [location.pathname]);

  return (
    <div className={frameClass} data-current-route={location.pathname}>
        <Navigation sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="app-main"><Routes>
          <Route path="/" element={<Registration />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/login" element={<Login />} />
          <Route path="/license-verification" element={<ProtectedRoute><LicenseVerification /></ProtectedRoute>} />
          <Route path="/catalog" element={<VehicleCatalog />} />
          <Route path="/compare" element={<ProtectedRoute><Comparison /></ProtectedRoute>} />
          <Route path="/checkout/:vehicleId" element={<ProtectedRoute><BookingCheckout /></ProtectedRoute>} />
          <Route path="/inspection" element={<ProtectedRoute><DamageAndFuelLog /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLoginRoute />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes></main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <PageStateProvider><ComparisonProvider><AppLayout /></ComparisonProvider></PageStateProvider>
    </Router>
  );
}