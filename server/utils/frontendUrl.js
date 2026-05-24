const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:5173';
const PRODUCTION_FRONTEND_URL = 'https://triplannerapp.com';

const normalizeUrl = (value) => value.replace(/\/$/, '');

const getHeaderOrigin = (req) => {
  const origin = req?.headers?.origin;
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // Ignore malformed origin header.
    }
  }

  const referer = req?.headers?.referer;
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // Ignore malformed referer header.
    }
  }

  return null;
};

const getFrontendUrl = (req) => {
  if (process.env.FRONTEND_URL) {
    return normalizeUrl(process.env.FRONTEND_URL);
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_FRONTEND_URL;
  }

  return getHeaderOrigin(req) || DEFAULT_LOCAL_FRONTEND_URL;
};

module.exports = {
  DEFAULT_LOCAL_FRONTEND_URL,
  PRODUCTION_FRONTEND_URL,
  getFrontendUrl,
};
