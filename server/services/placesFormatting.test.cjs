const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatOpeningHours,
  buildPlaceContactInfo,
} = require('./placesFormatting');

test('formatOpeningHours joins weekday descriptions', () => {
  const formatted = formatOpeningHours({
    weekdayDescriptions: [
      'Monday: 9:00 AM – 5:00 PM',
      'Tuesday: 9:00 AM – 5:00 PM',
    ],
  });

  assert.equal(formatted, 'Monday: 9:00 AM – 5:00 PM\nTuesday: 9:00 AM – 5:00 PM');
});

test('formatOpeningHours returns undefined when hours are missing', () => {
  assert.equal(formatOpeningHours(undefined), undefined);
  assert.equal(formatOpeningHours({ weekdayDescriptions: [] }), undefined);
});

test('buildPlaceContactInfo combines phone and website', () => {
  assert.equal(
    buildPlaceContactInfo({
      nationalPhoneNumber: '+1 555-0100',
      websiteUri: 'https://example.com',
    }),
    '+1 555-0100 · https://example.com',
  );
});

test('buildPlaceContactInfo supports website-only places', () => {
  assert.equal(
    buildPlaceContactInfo({ websiteUri: 'https://museum.example' }),
    'https://museum.example',
  );
});
