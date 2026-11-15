'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Map as MapLibre,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useUi } from '@/components/ui-store';
import type { CalendarResponse } from '@/lib/api/types';

// MapLibre v6 runs tiles in a module worker; the bundler emits it as a separate asset.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

/** Supporting map (lazy-loaded): shows the AOI outline; a click proposes a point for the AOI form. */
export default function AoiMap({ aoi }: { aoi: CalendarResponse['aoi'] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const setDraftPoint = useUi((s) => s.setDraftPoint);

  const outline = (a: CalendarResponse['aoi']) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [a.ring ? a.ring.map((p) => [p[0], p[1]]) : []],
    },
  });

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MapLibre({
      container: container.current,
      style: 'https://demotiles.maplibre.org/style.json',
      bounds: aoi.bbox as [number, number, number, number],
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('aoi', { type: 'geojson', data: outline(aoi) });
      m.addLayer({
        id: 'aoi-fill',
        type: 'fill',
        source: 'aoi',
        paint: { 'fill-color': '#ff6a2b', 'fill-opacity': 0.12 },
      });
      m.addLayer({
        id: 'aoi-line',
        type: 'line',
        source: 'aoi',
        paint: { 'line-color': '#ff6a2b', 'line-width': 2 },
      });
    });
    m.on('click', (e: MapMouseEvent) => setDraftPoint({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once; AOI changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      (m.getSource('aoi') as GeoJSONSource | undefined)?.setData(outline(aoi));
      m.fitBounds(aoi.bbox as [number, number, number, number], { padding: 24, duration: 600 });
    };
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
  }, [aoi]);

  return (
    <div
      ref={container}
      className="border-line h-56 w-full overflow-hidden rounded-lg border"
      role="region"
      aria-label={`Map of ${aoi.label}. Click to propose a point for a custom area.`}
    />
  );
}
