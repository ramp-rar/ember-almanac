'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Map as MapLibre,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { useUi } from '@/components/ui-store';
import type { CalendarResponse } from '@/lib/api/types';
import { useI18n } from '@/lib/i18n/use-locale';

// MapLibre v6 runs tiles in a module worker; the bundler emits it as a separate asset.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

/**
 * Satellite imagery (Esri World Imagery: forests, fields, water are visible) draped over real
 * terrain (Mapzen Terrarium elevation tiles). Place names come from a separate label layer.
 */
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    labels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 13,
    },
    dem: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 12,
      attribution: 'Terrain: Mapzen / AWS Terrain Tiles',
    },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.9 } },
  ],
  terrain: { source: 'dem', exaggeration: 1.6 },
  sky: {
    'sky-color': '#7fb2e5',
    'horizon-color': '#dfeaf5',
    'fog-color': '#dfeaf5',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.2,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  },
};

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

/** 3D map with terrain. Shows the area outline; a click proposes a point for the area form. */
export default function AoiMap({
  aoi,
  hotspots,
}: {
  aoi: CalendarResponse['aoi'];
  /** [lon, lat, weight] points for the selected month (optional). */
  hotspots?: readonly (readonly [number, number, number])[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const setDraftPoint = useUi((s) => s.setDraftPoint);
  const [flat, setFlat] = useState(false);
  const M = useI18n().t.map;

  const outline = (a: CalendarResponse['aoi']) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [a.ring ? a.ring.map((p) => [p[0], p[1]]) : []],
    },
  });
  const points = (h: typeof hotspots) => ({
    type: 'FeatureCollection' as const,
    features: (h ?? []).map((p) => ({
      type: 'Feature' as const,
      properties: { w: p[2] },
      geometry: { type: 'Point' as const, coordinates: [p[0], p[1]] },
    })),
  });

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MapLibre({
      container: container.current,
      style: STYLE,
      bounds: aoi.bbox as [number, number, number, number],
      fitBoundsOptions: { padding: 40 },
      pitch: 55,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    m.on('load', () => {
      m.addSource('aoi', { type: 'geojson', data: outline(aoi) });
      m.addSource('hot', { type: 'geojson', data: EMPTY_FC });
      m.addLayer({
        id: 'aoi-fill',
        type: 'fill',
        source: 'aoi',
        paint: { 'fill-color': '#ff7136', 'fill-opacity': 0.1 },
      });
      m.addLayer({
        id: 'aoi-casing',
        type: 'line',
        source: 'aoi',
        paint: { 'line-color': '#000000', 'line-width': 5, 'line-opacity': 0.5 },
      });
      m.addLayer({
        id: 'aoi-line',
        type: 'line',
        source: 'aoi',
        paint: { 'line-color': '#ffb48f', 'line-width': 2.5 },
      });
      m.addLayer({
        id: 'hot-glow',
        type: 'circle',
        source: 'hot',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 8, 14],
          'circle-color': '#ff5a1f',
          'circle-opacity': ['interpolate', ['linear'], ['get', 'w'], 0, 0.35, 10, 0.9],
          'circle-blur': 0.7,
        },
      });
    });
    m.on('click', (e: MapMouseEvent) => {
      const p = e.lngLat.wrap();
      setDraftPoint({ lat: p.lat, lon: p.lng });
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once; changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      (m.getSource('aoi') as GeoJSONSource | undefined)?.setData(outline(aoi));
      m.fitBounds(aoi.bbox as [number, number, number, number], {
        padding: 40,
        duration: 900,
        pitch: flat ? 0 : 55,
      });
    };
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoi]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () =>
      (m.getSource('hot') as GeoJSONSource | undefined)?.setData(points(hotspots));
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspots]);

  const toggle3d = () => {
    const next = !flat;
    setFlat(next);
    map.current?.easeTo({ pitch: next ? 0 : 55, duration: 600 });
    map.current?.setTerrain(next ? null : { source: 'dem', exaggeration: 1.6 });
  };

  return (
    <div className="relative">
      <div
        ref={container}
        className="border-line h-[26rem] w-full overflow-hidden rounded-xl border lg:h-[32rem]"
        role="region"
        aria-label={M.aria(aoi.label)}
      />
      <button
        type="button"
        onClick={toggle3d}
        aria-pressed={!flat}
        className="bg-panel text-text border-line absolute bottom-8 left-3 min-h-9 rounded-full border px-3 text-xs font-medium shadow"
      >
        {flat ? M.to3d : M.toFlat}
      </button>
    </div>
  );
}
