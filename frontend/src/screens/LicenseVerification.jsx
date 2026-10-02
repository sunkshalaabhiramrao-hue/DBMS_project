import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getLicenseVerification, payForBooking, submitLicenseVerification } from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import PaymentSection from '../components/PaymentSection';
import { usePageState } from '../context/usePageState';

export default function LicenseVerification() {
  const { state: routeState } = useLocation();
  const navigate = useNavigate();
  const [storedBooking, setStoredBooking] = usePageState('license.booking', null);
  const [paymentStarted, setPaymentStarted] = usePageState('license.paymentStarted', false);
  const state = routeState?.vehicle ? routeState : storedBooking;
  const licenseStateKey = state?.vehicle?.id || state?.bookingId || 'general';
  const [files, setFiles] = usePageState(`license.files.${licenseStateKey}`, { licenseFront: null, licenseBack: null });
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = usePageState(`license.paymentReady.${licenseStateKey}`, false);
  const [licenseStatus, setLicenseStatus] = usePageState(`license.status.${licenseStateKey}`, 'loading');
  const [statusChecking, setStatusChecking] = useState(true);
  const [paymentError, setPaymentError] = useState('');
  const [error, setError] = useState('');

  const refreshLicenseStatus = async () => {
    setStatusChecking(true);
    try {
      const { data } = await getLicenseVerification();
      setLicenseStatus(data.status || 'action_needed');
      setPaymentReady(Boolean(data.verified && state?.vehicle));
    } catch (err) {
      setLicenseStatus('action_needed');
      setPaymentReady(false);
      setError(err.response?.data?.error || 'Could not check license review status.');
    } finally {
      setStatusChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    getLicenseVerification()
      .then(({ data }) => {
        if (!active) return;
        setLicenseStatus(data.status || 'action_needed');
        setPaymentReady(Boolean(data.verified && state?.vehicle));
      })
      .catch((err) => {
        if (!active) return;
        setLicenseStatus('action_needed');
        setPaymentReady(false);
        setError(err.response?.data?.error || 'Could not check license review status.');
      })
      .finally(() => { if (active) setStatusChecking(false); });
    return () => { active = false; };
  }, [setLicenseStatus, setPaymentReady, state]);

  useEffect(() => {
    if (licenseStatus !== 'submitted') return undefined;
    let active = true;
    const pollReviewStatus = async () => {
      try {
        const { data } = await getLicenseVerification();
        if (!active) return;
        setLicenseStatus(data.status || 'action_needed');
        setPaymentReady(Boolean(data.verified && state?.vehicle));
      } catch {
        // Keep the pending state during temporary network failures.
      }
    };
    const intervalId = window.setInterval(pollReviewStatus, 8000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [licenseStatus, setLicenseStatus, setPaymentReady, state]);

  const handleLicenseSubmit = async (event) => {
    event.preventDefault();
    if (!files.licenseFront || !files.licenseBack) {
      setError('Upload both the front and back photos of your license.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('licenseFront', files.licenseFront);
      formData.append('licenseBack', files.licenseBack);
      await submitLicenseVerification(formData);
      setLicenseStatus('submitted');
      setPaymentReady(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'License photo upload failed.');
      if (err.response?.status === 409) await refreshLicenseStatus();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async ({ cardNumber, expiry, cvv }) => {
    if (!state?.vehicle || !state?.bookingId || !cardNumber || !expiry || !cvv) {
      setPaymentError('Complete the payment details to confirm the booking.');
      return;
    }

    try {
      await payForBooking(state.bookingId, { cardNumber, expiry, cvv });
      setStoredBooking(null);
      setPaymentStarted(false);
      navigate('/bookings', { replace: true, state: { bookingId: state.bookingId, pickupLocation: state.pickupLocation } });
    } catch (err) {
      setPaymentError(err.response?.data?.error || 'Payment or booking failed. Ensure backend is running.');
    }
  };

  return <main style={styles.page}>
    <section style={styles.card}>
      <div style={styles.icon}><ShieldCheck size={25} /></div>
      <p style={styles.eyebrow}>{state?.bookingId ? 'BOOKING REQUEST' : 'DRIVER VERIFICATION'}</p>
      <h1 style={styles.title}>Driver's license review</h1>
      <p style={styles.subtitle}>{state?.bookingId ? 'Your vehicle is reserved. An administrator must approve your license before payment.' : 'License approval is stored on your account and applies to future bookings.'}</p>
      {state?.pickupLocation && <p style={styles.location}>Pickup at: <strong>{state.pickupLocation.name}, {state.pickupLocation.city}</strong><br />{state.pickupLocation.address}</p>}

      {licenseStatus === 'loading' && <p role="status" style={styles.pendingNote}>Checking your license status...</p>}

      {(licenseStatus === 'action_needed' || licenseStatus === 'rejected') && !paymentReady && (
        <form onSubmit={handleLicenseSubmit} style={styles.form}>
          {licenseStatus === 'rejected' && <p role="alert" style={styles.error}>Your previous submission was rejected. Upload clear front and back photos to submit again.</p>}
          <FileInput label="Front of license" field="licenseFront" files={files} setFiles={setFiles} />
          <FileInput label="Back of license" field="licenseBack" files={files} setFiles={setFiles} />
          {error && <p role="alert" style={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting} style={styles.button}><Camera size={17} /> {submitting ? 'Uploading...' : 'Submit photos'}</button>
        </form>
      )}

      {licenseStatus === 'submitted' && <div className="license-review-pending" role="status">
        <strong>Waiting for admin review</strong>
        <span>Your license photos have been submitted. Payment will appear here after an administrator approves them; this page checks automatically.</span>
        <button type="button" onClick={refreshLicenseStatus} disabled={statusChecking} style={styles.refreshButton}>{statusChecking ? 'Checking...' : 'Check review status'}</button>
      </div>}

      {licenseStatus === 'verified' && !state?.vehicle && <div className="license-review-pending" role="status">
        <strong>LICENSE VERIFIED</strong>
        <span>Your license is approved and will be used for future bookings. Choose a vehicle to continue.</span>
        <button type="button" onClick={() => navigate('/catalog')} style={styles.refreshButton}>Browse vehicles</button>
      </div>}

      {paymentReady && state?.vehicle && !paymentStarted && <div className="license-review-pending" role="status">
        <strong>LICENSE VERIFIED</strong>
        <span>Your license has been approved by an administrator. Continue to payment to complete this booking.</span>
        <button type="button" onClick={() => setPaymentStarted(true)} style={styles.refreshButton}>Proceed to payment</button>
      </div>}

      {paymentReady && state?.vehicle && paymentStarted && (
        <PaymentSection
          totalAmount={state?.totalAmount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(state.totalAmount) : '₹0.00'}
          onConfirm={handlePayment}
          loading={submitting}
          error={paymentError}
        />
      )}

      <p style={styles.note}><CheckCircle2 size={15} /> Uploaded image contents are reviewed by an administrator; they are not automatically recognized.</p>
    </section>
  </main>;
}

function FileInput({ label, field, files, setFiles }) {
  return <label style={styles.label}>{label}{files[field] && <span style={styles.fileStatus}>Selected: {files[field].name}</span>}<input type="file" required={!files[field]} onChange={(event) => {
    const file = event.target.files[0];
    setFiles({ ...files, [field]: file || null });
  }} style={styles.input} /></label>;
}

const styles = {
  page: { minHeight: 'calc(100vh - 57px)', display: 'grid', placeItems: 'center', padding: '32px 16px', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: '500px', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '16px', padding: '32px', textAlign: 'left', boxShadow: '0 20px 45px rgba(38, 76, 112, 0.14)' },
  icon: { width: '48px', height: '48px', display: 'grid', placeItems: 'center', color: '#087f8c', background: '#dff8f4', borderRadius: '12px', marginBottom: '24px' },
  eyebrow: { color: '#087f8c', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px' },
  title: { color: '#172a46', fontSize: '2rem', margin: '0 0 8px' },
  subtitle: { color: '#52637a', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' },
  form: { display: 'grid', gap: '16px' },
  location: { color: '#40536d', background: '#f8fbff', border: '1px solid #d9e4f2', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' },
  label: { display: 'grid', gap: '6px', color: '#40536d', fontSize: '0.9rem', fontWeight: '600' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px', background: '#f8fbff', color: '#172a46', border: '1px solid #b9cce2', borderRadius: '8px' },
  fileStatus: { color: '#18734b', fontSize: '0.82rem', fontWeight: '500' },
  error: { color: '#b42345', background: '#fff0f2', padding: '10px 12px', borderRadius: '8px', margin: 0 },
  button: { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', background: '#087f8c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  note: { display: 'flex', alignItems: 'center', gap: '6px', color: '#718198', fontSize: '0.8rem', marginBottom: 0 }
  ,pendingNote: { color: '#805d16', background: '#fff5d6', border: '1px solid #f3d785', padding: '10px 12px', borderRadius: '8px', fontSize: '0.86rem', lineHeight: 1.45 },
  verifiedNote: { color: '#18734b', background: '#e5f8ed', border: '1px solid #b8e4ca', padding: '10px 12px', borderRadius: '8px', fontSize: '0.86rem', lineHeight: 1.45 },
  refreshButton: { padding: '8px 10px', color: '#805d16', background: '#fff', border: '1px solid #e6cc7a', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }
};
