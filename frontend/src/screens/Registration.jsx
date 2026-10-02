import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { registerUser, requestRegistrationOtp } from '../services/api';
import { usePageState, useResetPageState } from '../context/usePageState';

const EMPTY_REGISTRATION_FORM = { name: '', email: '', aadhaarId: '', phone: '' };

export default function Registration() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetPageState = useResetPageState();
  const [form, setForm] = usePageState('registration.form', EMPTY_REGISTRATION_FORM);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    localStorage.removeItem('rentalToken');
    localStorage.removeItem('rentalUser');
    resetPageState();
  }, [resetPageState]);
  const [otpSent, setOtpSent] = usePageState('registration.otpSent', false);
  const [developmentOtp, setDevelopmentOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (event) => {
    if (event.target.name === 'password') setPassword(event.target.value);
    else setForm({ ...form, [event.target.name]: event.target.value });
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const repeatedDigits = /(\d)\1{4,}/;
    const invalidAadhaar = !/^[2-9]\d{11}$/.test(form.aadhaarId)
      || repeatedDigits.test(form.aadhaarId);
    const invalidPhone = !/^[6-9]\d{9}$/.test(form.phone)
      || repeatedDigits.test(form.phone);

    if (invalidAadhaar || invalidPhone) {
      setError('Please enter correct phone number or Aadhaar');
      return;
    }

    setLoading(true);

    try {
      const response = await requestRegistrationOtp({ ...form, password });
      setOtpSent(true);
      setDevelopmentOtp(response.data.developmentOtp || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send OTP. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    localStorage.removeItem('rentalToken');
    localStorage.removeItem('rentalUser');

    try {
      const response = await registerUser({ phone: form.phone, otp });
      localStorage.setItem('rentalToken', response.data.token);
      localStorage.setItem('rentalUser', JSON.stringify(response.data.user));
      navigate(location.state?.from || '/catalog', { replace: true, state: location.state?.fromState });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.icon}><UserPlus size={24} /></div>
        <p style={styles.eyebrow}>WELCOME TO DRIVEIN</p>
        <h1 style={styles.title}>Start your journey</h1>
        <p style={styles.subtitle}>{otpSent ? `Enter the OTP sent to ${form.phone}.` : 'Create an account to browse our fleet and reserve your next ride.'}</p>

        {!otpSent ? <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Full name
            <input name="name" value={form.name} onChange={updateField} placeholder="Your name" autoComplete="name" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Email address
            <input name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" autoComplete="email" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Aadhaar ID
            <input name="aadhaarId" value={form.aadhaarId} onChange={updateField} placeholder="12-digit Aadhaar ID" inputMode="numeric" maxLength={12} required style={styles.input} />
          </label>
          <label style={styles.label}>
            Phone number
            <input name="phone" type="tel" value={form.phone} onChange={updateField} placeholder="10-digit phone number" inputMode="numeric" maxLength={10} autoComplete="tel" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Password
            <input name="password" type="password" value={password} onChange={updateField} placeholder="At least 6 characters" autoComplete="new-password" minLength={6} required style={styles.input} />
          </label>
          {error && <p role="alert" style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form> : <form onSubmit={handleVerify} style={styles.form}>
          <label style={styles.label}>
            One-time password
            <input value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }} placeholder="Enter 6-digit OTP" inputMode="numeric" maxLength={6} required style={styles.input} />
          </label>
          {developmentOtp && <p style={styles.demoOtp}>Development OTP: {developmentOtp}</p>}
          {error && <p role="alert" style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Verifying...' : 'Verify OTP & create account'}
          </button>
          <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setDevelopmentOtp(''); setError(''); }} style={styles.linkButton}>Edit registration details</button>
        </form>}
        <p style={styles.switchText}>Already have an account? <button type="button" onClick={() => navigate('/login', { state: location.state })} style={styles.linkButton}>Log in</button></p>
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
  demoOtp: { color: '#8a5b00', background: '#fff5d6', padding: '10px 12px', borderRadius: '8px', margin: 0, fontSize: '0.9rem' }
  ,switchText: { color: '#52637a', textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' },
  linkButton: { padding: 0, background: 'none', border: 'none', color: '#087f8c', cursor: 'pointer', fontSize: 'inherit' }
};
