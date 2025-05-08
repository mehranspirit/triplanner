import React from 'react';
import { cn } from '@/lib/utils';
import { EventType } from '@/types/eventTypes';
import { eventColors } from '@/utils/eventGlow';

interface GlowingIconProps {
  icon: React.ReactNode;
  isActive: boolean;
  isExploring: boolean;
  eventType: EventType;
  className?: string;
}

const GlowingIcon: React.FC<GlowingIconProps> = ({
  icon,
  isActive,
  isExploring,
  eventType,
  className
}) => {
  const color = eventColors[eventType];
  
  return (
    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
      <div className={cn(
        "rounded-full p-4 transition-all duration-200 relative",
        isExploring 
          ? "bg-transparent border-2 border-gray-400 border-dashed" 
          : "bg-white/90 shadow-lg",
        className
      )}>
        {isActive && !isExploring && (
          <div 
            className="absolute inset-0 rounded-full animate-pulse-glow"
            style={{ '--glow-color': `rgba(var(--${color}-500-rgb), var(--glow-opacity, 0.4))` } as React.CSSProperties}
          />
        )}
        {React.cloneElement(icon as React.ReactElement, {
          className: cn(
            "h-8 w-8 transition-all duration-200 relative z-10",
            `text-${color}-500`,
            isExploring && "filter brightness-90",
            isActive && !isExploring && "brightness-125"
          )
        })}
      </div>
    </div>
  );
};

export default GlowingIcon; 