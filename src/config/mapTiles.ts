export type MapTileStyle = 'streets' | 'outdoor';

const MAP_STYLE_IDS: Record<MapTileStyle, string> = {
  streets: 'streets-v2',
  outdoor: 'outdoor-v2',
};

export const getMapTilerTileUrl = (style: MapTileStyle, apiKey: string) => {
  const mapId = MAP_STYLE_IDS[style];
  return `https://api.maptiler.com/maps/${mapId}/{z}/{x}/{y}.png?key=${apiKey}`;
};

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAPTILER_ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const resolveMapTileLayer = (style: MapTileStyle) => {
  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;

  if (apiKey) {
    return {
      url: getMapTilerTileUrl(style, apiKey),
      attribution: MAPTILER_ATTRIBUTION,
    };
  }

  return {
    url: OSM_TILE_URL,
    attribution: OSM_ATTRIBUTION,
  };
};

export const resolveMapTileStyleForTrip = (tripStart: Date | null, tripEnd: Date | null): MapTileStyle => {
  if (!tripStart || !tripEnd) return 'streets';

  const now = new Date();
  if (now >= tripStart && now <= tripEnd) return 'outdoor';
  return 'streets';
};
