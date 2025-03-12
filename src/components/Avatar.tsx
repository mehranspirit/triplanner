import React, { useState, useEffect } from 'react';

interface AvatarProps {
  photoUrl: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ photoUrl, name, size = 'md', className = '' }) => {
  const [showFallback, setShowFallback] = useState(!photoUrl);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    console.log('Avatar - Props received:', {
      photoUrl,
      name,
      size,
      className,
      timestamp: new Date().toISOString()
    });

    if (photoUrl) {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      let fullUrl = photoUrl;
      
      // Log the URL construction process
      console.log('Avatar - URL construction process:', {
        originalUrl: photoUrl,
        apiUrl,
        startsWithHttp: photoUrl.startsWith('http'),
        startsWithUploads: photoUrl.startsWith('/uploads'),
        timestamp: new Date().toISOString()
      });
      
      // If the URL is relative (starts with /uploads) and doesn't already include the API URL
      if (photoUrl.startsWith('/uploads') && !photoUrl.includes(apiUrl)) {
        fullUrl = `${apiUrl}${photoUrl}`;
        console.log('Avatar - URL modified:', {
          originalUrl: photoUrl,
          constructedUrl: fullUrl,
          timestamp: new Date().toISOString()
        });
      }

      // Pre-load the image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log('Avatar - Image preloaded successfully:', {
          url: fullUrl,
          width: img.width,
          height: img.height,
          timestamp: new Date().toISOString()
        });
        setImageUrl(fullUrl);
        setShowFallback(false);
      };
      img.onerror = (error) => {
        console.error('Avatar - Image preload failed:', {
          url: fullUrl,
          error,
          timestamp: new Date().toISOString()
        });
        setShowFallback(true);
      };
      img.src = fullUrl;
    } else {
      console.log('Avatar - No photo URL provided, showing initials for:', {
        name,
        timestamp: new Date().toISOString()
      });
      setImageUrl(null);
      setShowFallback(true);
    }
  }, [photoUrl, name]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  const baseClasses = 'relative inline-flex items-center justify-center rounded-full overflow-hidden bg-gray-100';
  const textClasses = showFallback ? 'font-medium text-gray-600' : '';

  return (
    <div className={`${baseClasses} ${sizeClasses[size]} ${className} ${textClasses}`}>
      {showFallback ? (
        <span>{getInitials(name)}</span>
      ) : (
        <img
          src={imageUrl || ''}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setShowFallback(true)}
        />
      )}
    </div>
  );
};

export default Avatar; 