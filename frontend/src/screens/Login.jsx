import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { loginUser } from '../services/api';
import { usePageState, useResetPageState } from '../context/usePageState';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetPageState = useResetPageState();
  const [email, setEmail] = usePageState('login.email', '');
  const [password, setPassword] = useState('');
  const form = { email, password };

  useEffect(() => {
    localStorage.removeItem('rentalToken');
    localStorage.removeItem('rentalUser');
    resetPageState();
  }, [resetPageState]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (event) => {
    if (event.target.name === 'email') setEmail(event.target.value);
    else setPassword(event.target.value);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    localStorage.removeItem('rentalToken');
    localStorage.removeItem('rentalUser');

    try {
      const response = await loginUser(form);
      localStorage.setItem('rentalToken', response.data.token);
      localStorage.setItem('rentalUser', JSON.stringify(response.data.user));
      navigate(location.state?.from || '/catalog', { replace: true, state: location.state?.fromState });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.icon}><LogIn size={24} /></div>
        <p style={styles.eyebrow}>WELCOME BACK TO DRIVEIN</p>
        <h1 style={styles.title}>Log in to continue</h1>
        <p style={styles.subtitle}>Sign in to explore the fleet and manage your reservations.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email address
            <input name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" autoComplete="email" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Password
            <input name="password" type="password" value={form.password} onChange={updateField} placeholder="Your password" autoComplete="current-password" required style={styles.input} />
          </label>
          {error && <p role="alert" style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>
        <p style={styles.switchText}>New to DriveIn? <button type="button" onClick={() => navigate('/register', { state: location.state })} style={styles.linkButton}>Create an account</button></p>
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: 'calc(100vh - 57px)', display: 'grid', placeItems: 'center', padding: '32px 16px', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: '440px', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '16px', padding: '32px', textAlign: 'left', boxShadow: '0 20px 45px rgba(38, 76, 112, 0.14)' },
  icon: { width: '48px', height: '48px', display: 'grid', placeItems: 'center', color: '#087f8c', background: '#dff8f4', borderRadius: '12px', marginBottom: '24px' },
  eyebrow: { color: '#087f8c', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px' },
  title: { color: '#172a46', fontSize: '2rem', margin: '0 0 8px' },
  subtitle: { color: '#52637a', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' },
  form: { display: 'grid', gap: '16px' },
  label: { display: 'grid', gap: '6px', color: '#40536d', fontSize: '0.9rem', fontWeight: '600' },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#f8fbff', color: '#172a46', border: '1px solid #b9cce2', borderRadius: '8px', fontSize: '1rem', outline: 'none' },
  error: { color: '#b42345', background: '#fff0f2', padding: '10px 12px', borderRadius: '8px', margin: 0, fontSize: '0.9rem' },
  button: { padding: '12px', background: '#087f8c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  switchText: { color: '#52637a', textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' },
  linkButton: { padding: 0, background: 'none', border: 'none', color: '#087f8c', cursor: 'pointer', fontSize: 'inherit' }
};
