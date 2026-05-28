import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMapTilerTileUrl, OSM_TILE_URL, resolveMapTileLayer } from '@/config/mapTiles';

describe('mapTiles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds MapTiler URLs for streets and outdoor styles', () => {
    expect(getMapTilerTileUrl('streets', 'test-key')).toContain('streets-v2');
    expect(getMapTilerTileUrl('outdoor', 'test-key')).toContain('outdoor-v2');
  });

  it('falls back to OSM when no MapTiler key is configured', () => {
    vi.stubEnv('VITE_MAPTILER_API_KEY', '');
    const layer = resolveMapTileLayer('outdoor');
    expect(layer.url).toBe(OSM_TILE_URL);
  });
});
