const test = require('node:test');
const assert = require('node:assert/strict');

const { blocksVehicleAvailability, getInitialBookingStatus, getReviewBookingStatus, hasDateOverlap } = require('../bookingLogic');

test('pending booking states do not block vehicle availability', () => {
  assert.equal(blocksVehicleAvailability('awaiting_license'), false);
  assert.equal(blocksVehicleAvailability('awaiting_payment'), false);
  assert.equal(blocksVehicleAvailability('license_rejected'), false);
});

test('confirmed bookings still block vehicle availability', () => {
  assert.equal(blocksVehicleAvailability('confirmed'), true);
});

test('new bookings move to payment after an approved license review', () => {
  assert.equal(getInitialBookingStatus('verified'), 'awaiting_payment');
  assert.equal(getReviewBookingStatus('verified'), 'awaiting_payment');
  assert.equal(getReviewBookingStatus('rejected'), 'license_rejected');
});

test('only overlapping date ranges count as duplicate pending bookings', () => {
  assert.equal(hasDateOverlap('2026-11-01', '2026-11-05', '2026-11-06', '2026-11-10'), false);
  assert.equal(hasDateOverlap('2026-11-01', '2026-11-05', '2026-11-04', '2026-11-08'), true);
});
