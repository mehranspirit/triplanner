import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Ticket, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/services/api';

const TripInviteAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'accepting' | 'accepted' | 'error'>('accepting');
  const [message, setMessage] = useState('Accepting your trip invitation...');
  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const acceptInvite = async () => {
      if (!token) {
        setStatus('error');
        setMessage('This invite link is missing a token.');
        return;
      }

      try {
        const result = await api.acceptTripInviteLink(token);
        if (!isMounted) return;
        setTripId(result.trip._id);
        setStatus('accepted');
        setMessage(`You're in. Opening ${result.trip.name}...`);
        setTimeout(() => navigate(`/trips/${result.trip._id}`, { replace: true }), 1000);
      } catch (error) {
        if (!isMounted) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to accept this invite link.');
      }
    };

    acceptInvite();

    return () => {
      isMounted = false;
    };
  }, [navigate, token]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl shadow-slate-900/10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          {status === 'accepting' && <Loader2 className="h-7 w-7 animate-spin" />}
          {status === 'accepted' && <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
          {status === 'error' && <XCircle className="h-7 w-7 text-red-600" />}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Trip invitation
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          {status === 'error' ? 'Invite unavailable' : 'Joining trip'}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
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
