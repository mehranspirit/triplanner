import React from 'react';
import { User } from '@/types/eventTypes';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface CollaboratorAvatarsProps {
  owner: User;
  collaborators: Array<{ user: User; role: 'viewer' | 'editor' }>;
  currentUserId?: string;
  className?: string;
}

export const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({
  owner,
  collaborators,
  currentUserId,
  className
}) => {
  // Filter out the current user from both owner and collaborators
  const showOwner = owner._id !== currentUserId;
  const filteredCollaborators = collaborators.filter(c => c.user._id !== currentUserId);
  
  // Calculate total number of avatars to show
  const totalAvatars = (showOwner ? 1 : 0) + filteredCollaborators.length;
  
  // If no avatars to show, return null
  if (totalAvatars === 0) return null;

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      <TooltipProvider>
        {/* Show owner first if not current user */}
        {showOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative inline-block">
                <Avatar className="h-10 w-10 border-2 border-white hover:translate-y-[-2px] transition-transform duration-200">
                  {owner.photoUrl && <AvatarImage src={owner.photoUrl} alt={owner.name} className="object-cover" />}
                  <AvatarFallback className="bg-amber-100 text-amber-900 font-medium">{owner.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{owner.name}</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Show collaborators */}
        {filteredCollaborators.map((collaborator, index) => (
          <Tooltip key={collaborator.user._id}>
            <TooltipTrigger asChild>
              <div className="relative inline-block">
                <Avatar className="h-10 w-10 border-2 border-white hover:translate-y-[-2px] transition-transform duration-200">
                  {collaborator.user.photoUrl && (
                    <AvatarImage src={collaborator.user.photoUrl} alt={collaborator.user.name} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-blue-100 text-blue-900 font-medium">{collaborator.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{collaborator.user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{collaborator.role}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}; 