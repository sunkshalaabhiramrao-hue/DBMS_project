import { useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { getAdminLicensePhoto, getAdminUser, getAdminUsers, reviewAdminLicense } from '../services/api';
import './AdminDashboard.css';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';
const formatMoney = (value) => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const statusLabel = (status) => ({
  not_submitted: 'Not submitted', submitted: 'Pending review', verified: 'Approved', rejected: 'Rejected',
  awaiting_license: 'Awaiting license', license_rejected: 'License rejected', awaiting_payment: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled'
}[status] || status);

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [details, setDetails] = useState(null);
  const [licensePhotos, setLicensePhotos] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminUsers()
      .then(({ data }) => {
        if (!active) return;
        setUsers(data);
        setSelectedUserId((current) => current || String(data[0]?.id || ''));
      })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'Could not load customer accounts.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedUserId) return undefined;

    let active = true;
    const objectUrls = [];
    getAdminUser(selectedUserId)
      .then(async ({ data }) => {
        if (!active) return;
        setDetails(data);
        const photos = {};
        const sides = [
          ['front', data.license.hasFrontPhoto],
          ['back', data.license.hasBackPhoto]
        ];
        await Promise.all(sides.map(async ([side, available]) => {
          if (!available) return;
          try {
            const response = await getAdminLicensePhoto(selectedUserId, side);
            const objectUrl = URL.createObjectURL(response.data);
            objectUrls.push(objectUrl);
            photos[side] = objectUrl;
          } catch {
            photos[side] = '';
          }
        }));
        if (active) setLicensePhotos(photos);
        else objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'Could not load this customer.'); });

    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [selectedUserId, refreshKey]);

  const handleReview = async (status) => {
    if (!selectedUserId) return;
    setReviewing(true);
    setError('');
    try {
      await reviewAdminLicense(selectedUserId, status);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the license review.');
    } finally {
      setReviewing(false);
    }
  };

  const filteredUsers = users.filter((user) => `${user.name} ${user.email} ${user.phone} ${user.id}`.toLowerCase().includes(search.toLowerCase()));
  const selectedDetails = String(details?.user?.id) === String(selectedUserId) ? details : null;
  const licenseStatus = selectedDetails?.license?.status || 'not_submitted';

  return <main className="admin-page">
    <header className="admin-header">
      <div>
        <p className="admin-eyebrow">FLEET OPERATIONS</p>
        <h1>Customer & license review</h1>
        <p className="admin-muted">Review submitted licenses and view each customer’s booking history.</p>
      </div>
      <div className="admin-header-actions">
        <button type="button" className="admin-quiet-button" onClick={() => setRefreshKey((key) => key + 1)} aria-label="Refresh customer data" title="Refresh"><RefreshCw size={17} /></button>
      </div>
    </header>

    {error && <p role="alert" className="admin-error">{error}</p>}
    <div className="admin-workspace">
      <section className="admin-queue" aria-label="Customer list">
        <div className="admin-queue-heading"><h2>Customers</h2><span>{users.length}</span></div>
        <input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone, ID" aria-label="Search customers" />
        {loading ? <p className="admin-muted">Loading customers...</p> : filteredUsers.length === 0 ? <p className="admin-muted">No customers found.</p> : <div className="admin-user-list">
          <table className="admin-user-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Bookings</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={String(user.id) === String(selectedUserId) ? 'admin-user-row is-selected' : 'admin-user-row'}
                  onClick={() => setSelectedUserId(String(user.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedUserId(String(user.id));
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View customer ${user.name}`}
                >
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td>
                  <td><span className={`admin-status status-${user.license_status}`}>{statusLabel(user.license_status)}</span></td>
                  <td>{user.booking_count} booking{Number(user.booking_count) === 1 ? '' : 's'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </section>

      <section className="admin-detail" aria-label="Selected customer details">
        {!selectedDetails ? <div className="admin-empty"><ShieldCheck size={26} /><p>Select a customer to review their details.</p></div> : <>
          <div className="admin-detail-heading">
            <div><p className="admin-eyebrow">CUSTOMER #{selectedDetails.user.id}</p><h2>{selectedDetails.user.name}</h2><p className="admin-muted">Joined {formatDate(selectedDetails.user.created_at)}</p></div>
            <span className={`admin-status status-${licenseStatus}`}>{statusLabel(licenseStatus)}</span>
          </div>

          <dl className="admin-user-details">
            <div><dt>Email</dt><dd>{selectedDetails.user.email || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{selectedDetails.user.phone || '—'}</dd></div>
            <div><dt>Aadhaar ID</dt><dd>{selectedDetails.user.aadhaar_id || '—'}</dd></div>
            <div><dt>License submission</dt><dd>{selectedDetails.license.updatedAt ? formatDate(selectedDetails.license.updatedAt) : '—'}</dd></div>
          </dl>

          <section className="admin-section">
            <div className="admin-section-heading"><h3>License photos</h3><span className={`admin-status status-${licenseStatus}`}>{statusLabel(licenseStatus)}</span></div>
            {!selectedDetails.license.hasFrontPhoto && !selectedDetails.license.hasBackPhoto ? <p className="admin-muted">No license photos submitted.</p> : <div className="admin-photo-grid">
              {['front', 'back'].map((side) => <figure key={side} className="admin-photo">
                <figcaption>{side === 'front' ? 'Front of license' : 'Back of license'}</figcaption>
                {licensePhotos[side] ? <img src={licensePhotos[side]} alt={`${side} of driver's license`} /> : <div className="admin-photo-unavailable">Photo unavailable</div>}
              </figure>)}
            </div>}
            {licenseStatus === 'submitted' && <div className="admin-review-actions">
              <button type="button" className="admin-approve" disabled={reviewing} onClick={() => handleReview('verified')}><Check size={16} /> Approve license</button>
              <button type="button" className="admin-reject" disabled={reviewing} onClick={() => handleReview('rejected')}><X size={16} /> Reject</button>
            </div>}
            {licenseStatus === 'rejected' && <p className="admin-review-note">Rejected. The customer may upload corrected photos.</p>}
          </section>

          <section className="admin-section">
            <div className="admin-section-heading"><h3>Bookings</h3><span>{selectedDetails.bookings.length}</span></div>
            {selectedDetails.bookings.length === 0 ? <p className="admin-muted">No bookings for this customer.</p> : <div className="admin-booking-list">
              {selectedDetails.bookings.map((booking) => <article key={booking.id} className="admin-booking-row">
                <div><strong>{booking.brand} {booking.model}</strong><small>{booking.start_date} to {booking.end_date}</small><small>{booking.pickup_location_name || 'Pickup'}{booking.pickup_location_city ? `, ${booking.pickup_location_city}` : ''}</small></div>
                <div className="admin-booking-meta"><span>{booking.id}</span><span>{statusLabel(booking.status || booking.deployment_status || '—')}</span><strong>{formatMoney(booking.total_amount)}</strong></div>
              </article>)}
            </div>}
          </section>
        </>}
      </section>
    </div>
  </main>;
}
