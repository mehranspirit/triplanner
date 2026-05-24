import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, LogIn, Ticket, UserPlus, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useTrip } from '@/context/TripContext';
import {
  getInvitePath,
  savePendingInviteToken,
  clearPendingInviteToken,
} from '@/utils/tripInvite';

type InviteStatus = 'loading' | 'needs-auth' | 'accepting' | 'accepted' | 'error';

const TripInviteAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { addTrip } = useTrip();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [message, setMessage] = useState('Checking your invitation...');
  const [tripId, setTripId] = useState<string | null>(null);
  const acceptStartedRef = useRef(false);

  const invitePath = token ? getInvitePath(token) : '/trips';

  useEffect(() => {
    if (token) {
      savePendingInviteToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This invite link is missing a token.');
      return;
    }

    if (isLoading) {
      setStatus('loading');
      setMessage('Checking your invitation...');
      return;
    }

    if (!isAuthenticated) {
      acceptStartedRef.current = false;
      setStatus('needs-auth');
      setMessage('Sign in or create an account to join this trip.');
      return;
    }

    if (acceptStartedRef.current) {
      return;
    }
    acceptStartedRef.current = true;

    let isMounted = true;

    const acceptInvite = async () => {
      setStatus('accepting');
      setMessage('Accepting your trip invitation...');

      try {
        const result = await api.acceptTripInviteLink(token);
        if (!isMounted) return;

        await addTrip(result.trip);
        clearPendingInviteToken();

        setTripId(result.trip._id);
        setStatus('accepted');
        setMessage(`You're in. Opening ${result.trip.name}...`);
        window.setTimeout(() => navigate(`/trips/${result.trip._id}`, { replace: true }), 800);
      } catch (error) {
        acceptStartedRef.current = false;
        if (!isMounted) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to accept this invite link.');
      }
    };

    acceptInvite();

    return () => {
      isMounted = false;
    };
  }, [addTrip, isAuthenticated, isLoading, navigate, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl shadow-slate-900/10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          {(status === 'loading' || status === 'accepting') && <Loader2 className="h-7 w-7 animate-spin" />}
          {status === 'accepted' && <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
          {status === 'error' && <XCircle className="h-7 w-7 text-red-600" />}
          {status === 'needs-auth' && <Ticket className="h-7 w-7" />}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Trip invitation
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          {status === 'error' ? 'Invite unavailable' : status === 'needs-auth' ? 'Join this trip' : 'Joining trip'}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {status === 'needs-auth' && (
            <>
              <Button asChild>
                <Link to="/login" state={{ from: { pathname: invitePath } }}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/register" state={{ from: { pathname: invitePath } }}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create account
                </Link>
              </Button>
            </>
          )}
          {status === 'accepted' && tripId && (
            <Button onClick={() => navigate(`/trips/${tripId}`, { replace: true })}>
              <Ticket className="mr-2 h-4 w-4" />
              Open trip
            </Button>
          )}
          {status === 'error' && (
            <Button variant="outline" onClick={() => navigate('/trips', { replace: true })}>
              Back to trips
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripInviteAccept;
