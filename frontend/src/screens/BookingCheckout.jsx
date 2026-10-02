import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createBooking, getPickupLocations } from '../services/api';
import { usePageState } from '../context/usePageState';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

export default function BookingCheckout() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const vehicle = state?.vehicle;
  const checkoutStateKey = `checkout.${vehicle?.id || 'unknown'}`;
  const [, setLicenseBooking] = usePageState('license.booking', null);
  const [, setPaymentStarted] = usePageState('license.paymentStarted', false);

  const [startDate, setStartDate] = usePageState(`${checkoutStateKey}.startDate`, state?.startDate || '');
  const [endDate, setEndDate] = usePageState(`${checkoutStateKey}.endDate`, state?.endDate || '');
  const [pickupLocationId, setPickupLocationId] = usePageState(`${checkoutStateKey}.pickupLocationId`, state?.pickupLocationId || '');
  const [pickupLocation, setPickupLocation] = usePageState(`${checkoutStateKey}.pickupLocation`, state?.pickupLocation || null);
  const [pickupLocationOptions, setPickupLocationOptions] = useState([]);
  const [pickupTime, setPickupTime] = usePageState(`${checkoutStateKey}.pickupTime`, state?.pickupTime || '');
  const [checkoutTime, setCheckoutTime] = usePageState(`${checkoutStateKey}.checkoutTime`, '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPickupLocations = async () => {
      try {
        const res = await getPickupLocations();
        const locations = res.data || [];
        setPickupLocationOptions(locations);

        if (state?.pickupLocation) {
          setPickupLocation(state.pickupLocation);
          setPickupLocationId(String(state.pickupLocation.id));
        }
      } catch (err) {
        console.error('Unable to load pickup locations', err);
      }
    };

    loadPickupLocations();
  }, [setPickupLocation, setPickupLocationId, state?.pickupLocation]);

  const rentalDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000))
    : 0;

  const handleBooking = async () => {
    if (!startDate || !endDate || startDate >= endDate || !pickupLocationId || !pickupTime || !checkoutTime) {
      setError('Choose valid dates, a pickup location, and times before confirming the booking.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await createBooking({
        vehicleId: vehicle.id,
        pickupLocationId: Number(pickupLocationId),
        startDate,
        endDate,
        pickupTime,
        checkoutTime,
        totalAmount: vehicle.daily_rate * rentalDays
      });
      const bookingDetails = {
        vehicle,
        bookingId: data.bookingId,
        pickupLocation,
        pickupLocationId,
        startDate,
        endDate,
        pickupTime,
        checkoutTime,
        totalAmount: vehicle.daily_rate * rentalDays
      };
      setLicenseBooking(bookingDetails);
      setPaymentStarted(false);
      navigate('/license-verification', { state: bookingDetails });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the booking. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (!vehicle) return <p style={{ color: '#172a46' }}>No vehicle selected. Return to catalog.</p>;

  return (
    <div style={{ padding: '16px', color: '#172a46', maxWidth: '500px', margin: 'auto' }}>
      <h2>Booking details</h2>
      <div style={{ background: '#ffffff', border: '1px solid #d9e4f2', padding: '16px', borderRadius: '12px', boxShadow: '0 16px 36px rgba(38, 76, 112, 0.12)' }}>
        <h3>{vehicle.brand} {vehicle.model}</h3>
        <p>Daily Rate: {formatINR(vehicle.daily_rate)}</p>
        <label style={{ display: 'block', margin: '8px 0 4px' }}>Start Date:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '12px', background: '#f8fbff', color: '#172a46', colorScheme: 'light', accentColor: '#087f8c', border: '1px solid #b9cce2', borderRadius: '7px' }} />
        <label style={{ display: 'block', margin: '8px 0 4px' }}>End Date:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '16px', background: '#f8fbff', color: '#172a46', colorScheme: 'light', accentColor: '#087f8c', border: '1px solid #b9cce2', borderRadius: '7px' }} />
        <label style={{ display: 'block', margin: '8px 0 4px' }}>Pickup location:</label>
        <select
          value={pickupLocationId}
          onChange={(e) => {
            const selectedId = e.target.value;
            setPickupLocationId(selectedId);
            setPickupLocation(pickupLocationOptions.find((location) => String(location.id) === String(selectedId)) || null);
          }}
          style={{ width: '100%', padding: '8px', marginBottom: '16px', background: '#f8fbff', color: '#172a46', border: '1px solid #b9cce2', borderRadius: '7px' }}
        >
          <option value="">Select a pickup branch</option>
          {pickupLocationOptions.map((location) => (
            <option key={location.id} value={location.id}>{location.name}, {location.city}</option>
          ))}
        </select>
        <label style={{ display: 'block', margin: '8px 0 4px' }}>Vehicle pickup time:</label>
        <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '16px', background: '#f8fbff', color: '#172a46', colorScheme: 'light', accentColor: '#087f8c', border: '1px solid #b9cce2', borderRadius: '7px' }} required />
        <label style={{ display: 'block', margin: '8px 0 4px' }}>Vehicle return time:</label>
        <input type="time" value={checkoutTime} onChange={(e) => setCheckoutTime(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '16px', background: '#f8fbff', color: '#172a46', colorScheme: 'light', accentColor: '#087f8c', border: '1px solid #b9cce2', borderRadius: '7px' }} required />
        {rentalDays > 0 && <p style={{ color: '#52637a' }}>Rental total: {formatINR(vehicle.daily_rate * rentalDays)} ({rentalDays} day{rentalDays === 1 ? '' : 's'})</p>}
      </div>

      {error && <p role="alert" style={{ color: '#b42345', background: '#fff0f2', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', marginTop: '12px' }}>{error}</p>}
      <button onClick={handleBooking} disabled={loading} style={{ width: '100%', padding: '12px', background: '#e89b18', color: '#172a46', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}>
        {loading ? 'Creating booking...' : 'Confirm booking'}
      </button>
    </div>
  );
}