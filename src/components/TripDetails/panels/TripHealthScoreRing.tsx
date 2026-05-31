import React from 'react';
import { cn } from '@/lib/utils';

const ringColor = (score: number) => {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-rose-500';
};

const sizeConfig = {
  sm: { box: 'h-11 w-11', viewBox: 44, center: 22, radius: 16, stroke: 4, text: 'text-xs' },
  md: { box: 'h-16 w-16', viewBox: 72, center: 36, radius: 28, stroke: 6, text: 'text-sm' },
} as const;

interface TripHealthScoreRingProps {
  score: number;
  size?: keyof typeof sizeConfig;
  className?: string;
}

const TripHealthScoreRing: React.FC<TripHealthScoreRingProps> = ({
  score,
  size = 'md',
  className,
}) => {
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn('relative shrink-0', config.box, className)}>
      <svg
        className={cn(config.box, '-rotate-90')}
        viewBox={`0 0 ${config.viewBox} ${config.viewBox}`}
        aria-hidden="true"
      >
        <circle
          cx={config.center}
          cy={config.center}
          r={config.radius}
          fill="none"
          strokeWidth={config.stroke}
          className="stroke-slate-100"
        />
        <circle
          cx={config.center}
          cy={config.center}
          r={config.radius}
          fill="none"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          className={cn('transition-all duration-500', ringColor(score))}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-bold text-slate-900', config.text)}>{score}</span>
      </div>
    </div>
  );
};

export default TripHealthScoreRing;
