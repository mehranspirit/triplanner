import axios from 'axios';

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;

interface Photo {
  src: {
    large2x: string;
  };
}

export async function createTravelCollage(): Promise<string> {
  const searchTerms = [
    'travel landscape',
    'beach vacation',
    'mountain hiking',
    'city skyline night',
    'ancient architecture',
    'tropical island',
    'adventure camping',
    'cultural festival'
  ];

  try {
    const photos: Photo[] = [];

    // Fetch photos for each search term
    for (const term of searchTerms) {
      const response = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=1`, {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      });
      
      if (response.data.photos.length > 0) {
        photos.push(response.data.photos[0]);
      }
    }

    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size
    canvas.width = 1920;
    canvas.height = 1080;

    // Load all images
    const loadedImages = await Promise.all(
      photos.map(photo => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = photo.src.large2x;
        });
      })
    );

    // Calculate grid dimensions
    const cols = 4;
    const rows = 2;
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    // Draw images in a grid
    loadedImages.forEach((img, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * cellWidth;
      const y = row * cellHeight;

      // Calculate scaling to fill cell while maintaining aspect ratio
      const scale = Math.max(cellWidth / img.width, cellHeight / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      // Center image in cell
      const dx = x + (cellWidth - scaledWidth) / 2;
      const dy = y + (cellHeight - scaledHeight) / 2;

      ctx.drawImage(img, dx, dy, scaledWidth, scaledHeight);
    });

    // Add overlay gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 image
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Error creating travel collage:', error);
    return '';
  }
} 