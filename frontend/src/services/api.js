import API from './apiClient';

export const loginUser = (credentials) => API.post('/auth/login', credentials);

export const requestRegistrationOtp = (userData) =>
  API.post('/auth/request-registration-otp', userData);

export const registerUser = (userData) => API.post('/auth/register', userData);

export const logoutUser = () => {
  localStorage.removeItem('rentalToken');
  localStorage.removeItem('rentalUser');
  window.location.href = '/login';
};

export const getVehicles = ({ startDate, endDate }) =>
  API.get('/vehicles', { params: { startDate, endDate } });

export const getFavorites = () => API.get('/favorites');

export const addFavorite = (vehicleId) => API.post(`/favorites/${vehicleId}`);

export const removeFavorite = (vehicleId) => API.delete(`/favorites/${vehicleId}`);

export const createBooking = (bookingData) => API.post('/bookings', bookingData);

export const payForBooking = (bookingId, paymentData) => API.post(`/bookings/${bookingId}/payment`, paymentData);

export const getBookings = () => API.get('/bookings');

export const getMyBookings = getBookings;

export const cancelBooking = (bookingId) =>
  API.patch(`/bookings/${bookingId}/cancel`);

export const getProfile = () => API.get('/profile');

export const updateProfile = (profileData) => API.put('/profile', profileData);

export const submitLicenseVerification = (formData) =>
  API.post('/license-verification', formData);

export const getLicenseVerification = () => API.get('/license-verification');

export const adminLogin = (credentials) => API.post('/admin/login', credentials);

export const getAdminUsers = () => API.get('/admin/users');

export const getAdminUser = (userId) => API.get(`/admin/users/${userId}`);

export const getAdminLicensePhoto = (userId, side) =>
  API.get(`/admin/users/${userId}/license/${side}`, { responseType: 'blob' });

export const reviewAdminLicense = (userId, status) =>
  API.post(`/admin/users/${userId}/license/review`, { status });

export const getPickupLocations = () => API.get('/pickup-locations');

export const uploadDamageLog = (formData) => API.post('/rentals/log', formData);