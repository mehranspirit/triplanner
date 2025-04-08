const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const PEXELS_API_URL = 'https://api.pexels.com/v1';

export const pexelsService = {
  async searchImage(query: string): Promise<string | null> {
    try {
      const response = await fetch(`${PEXELS_API_URL}/search?query=${encodeURIComponent(query)}&per_page=1`, {
        headers: {
          Authorization: PEXELS_API_KEY || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch image from Pexels');
      }

      const data = await response.json();
      if (data.photos && data.photos.length > 0) {
        return data.photos[0].src.medium; // Using medium size for better performance
      }

      return null;
    } catch (error) {
      console.error('Error fetching image from Pexels:', error);
      return null;
    }
  }
}; 