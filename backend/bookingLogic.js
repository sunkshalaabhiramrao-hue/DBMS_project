const BLOCKING_AVAILABILITY_STATUSES = new Set(['confirmed']);
const PENDING_BOOKING_STATUSES = new Set(['awaiting_license', 'awaiting_payment', 'license_rejected']);

function blocksVehicleAvailability(status) {
  return BLOCKING_AVAILABILITY_STATUSES.has(String(status || '').trim().toLowerCase());
}

function isPendingBookingStatus(status) {
  return PENDING_BOOKING_STATUSES.has(String(status || '').trim().toLowerCase());
}

function hasDateOverlap(startDateA, endDateA, startDateB, endDateB) {
  if (!startDateA || !endDateA || !startDateB || !endDateB) return false;
  return new Date(startDateA) < new Date(endDateB) && new Date(startDateB) < new Date(endDateA);
}

function getInitialBookingStatus(licenseStatus) {
  return String(licenseStatus || '').trim() === 'verified' ? 'awaiting_payment' : 'awaiting_license';
}

function getReviewBookingStatus(reviewStatus) {
  return String(reviewStatus || '').trim() === 'verified' ? 'awaiting_payment' : 'license_rejected';
}

module.exports = {
  BLOCKING_AVAILABILITY_STATUSES,
  PENDING_BOOKING_STATUSES,
  blocksVehicleAvailability,
  hasDateOverlap,
  isPendingBookingStatus,
  getInitialBookingStatus,
  getReviewBookingStatus
};
