const PENDING_INVITE_TOKEN_KEY = 'pendingTripInviteToken';

export const getInvitePath = (token: string) => `/trips/invite/${token}`;

export const savePendingInviteToken = (token: string) => {
  if (!token) return;
  sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
};

export const getPendingInviteToken = () => sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);

export const clearPendingInviteToken = () => {
  sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
};

export const consumePendingInvitePath = (): string | null => {
  const token = getPendingInviteToken();
  if (!token) return null;
  clearPendingInviteToken();
  return getInvitePath(token);
};

export const getPostAuthRedirectPath = (
  locationState?: { from?: { pathname?: string; search?: string } } | null
): string => {
  const from = locationState?.from;
  if (from?.pathname) {
    return `${from.pathname}${from.search || ''}`;
  }

  const pendingPath = consumePendingInvitePath();
  if (pendingPath) {
    return pendingPath;
  }

  return '/trips';
};
