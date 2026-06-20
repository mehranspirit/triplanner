const formatOpeningHours = (regularOpeningHours) => {
  const descriptions = regularOpeningHours?.weekdayDescriptions;
  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    return undefined;
  }

  return descriptions.join('\n');
};

const buildPlaceContactInfo = ({ nationalPhoneNumber, internationalPhoneNumber, websiteUri }) => {
  const parts = [];
  const phone = nationalPhoneNumber || internationalPhoneNumber;
  if (phone) {
    parts.push(phone);
  }
  if (websiteUri) {
    parts.push(websiteUri);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
};

module.exports = {
  formatOpeningHours,
  buildPlaceContactInfo,
};
