const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:5173';
const PRODUCTION_FRONTEND_URL = 'https://triplannerapp.com';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

const normalizeUrl = (value) => value.replace(/\/$/, '');

const isLocalhostUrl = (value) => {
  try {
    return LOCAL_HOSTNAMES.has(new URL(value).hostname);
  } catch {
    return false;
  }
};

const isDeployedEnvironment = () => (
  process.env.NODE_ENV === 'production'
  || process.env.RENDER === 'true'
  || Boolean(process.env.RENDER_EXTERNAL_URL)
);

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
  const configured = process.env.FRONTEND_URL
    ? normalizeUrl(process.env.FRONTEND_URL)
    : null;

  // A localhost FRONTEND_URL should never win on Render/production.
  if (configured && !(isDeployedEnvironment() && isLocalhostUrl(configured))) {
    return configured;
  }

  if (isDeployedEnvironment()) {
    return getHeaderOrigin(req) || PRODUCTION_FRONTEND_URL;
  }

  return getHeaderOrigin(req) || DEFAULT_LOCAL_FRONTEND_URL;
};

module.exports = {
  DEFAULT_LOCAL_FRONTEND_URL,
  PRODUCTION_FRONTEND_URL,
  getFrontendUrl,
};
