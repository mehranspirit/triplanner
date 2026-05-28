import React from 'react';
import { cn } from '@/lib/utils';

interface MapViewSkeletonProps {
  className?: string;
}

const MapViewSkeleton: React.FC<MapViewSkeletonProps> = ({ className }) => (
  <div
    className={cn('relative h-full overflow-hidden bg-slate-900', className)}
    role="status"
    aria-label="Loading map"
  >
    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,41,59,0.9)_0%,rgba(15,23,42,0.95)_100%)]" />
    <div className="absolute inset-0 opacity-40">
      <div className="absolute left-[12%] top-[18%] h-24 w-24 animate-pulse rounded-full bg-slate-700/80 motion-reduce:animate-none" />
      <div className="absolute right-[20%] top-[32%] h-16 w-16 animate-pulse rounded-full bg-slate-700/60 motion-reduce:animate-none" />
      <div className="absolute bottom-[28%] left-[35%] h-20 w-20 animate-pulse rounded-full bg-slate-700/70 motion-reduce:animate-none" />
    </div>
    <div className="absolute inset-x-0 bottom-8 flex justify-center">
      <p className="text-sm text-slate-400">Loading map…</p>
    </div>
  </div>
);

export default MapViewSkeleton;
