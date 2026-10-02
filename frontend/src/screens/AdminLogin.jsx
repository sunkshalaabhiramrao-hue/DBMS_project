import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { adminLogin } from '../services/api';
import './AdminDashboard.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await adminLogin({ username, password });
      sessionStorage.setItem('rentalAdminToken', data.token);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Admin sign in failed. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="admin-login-page">
    <section className="admin-login-panel">
      <div className="admin-login-icon"><ShieldCheck size={24} /></div>
      <p className="admin-eyebrow">DRIVEIN FLEET · ADMIN</p>
      <h1>Sign in to review</h1>
      <p className="admin-muted">Manage customer bookings and license submissions.</p>
      <form className="admin-login-form" onSubmit={handleSubmit}>
        <label>Admin user ID<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Admin sign in'}</button>
      </form>
      <Link className="admin-return-link" to="/login">Return to customer sign in</Link>
    </section>
  </main>;
}
