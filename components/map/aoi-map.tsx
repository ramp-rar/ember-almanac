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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUi } from '@/components/ui-store';
import type { CalendarResponse } from '@/lib/api/types';
import { useI18n } from '@/lib/i18n/use-locale';

// MapLibre v6 runs tiles in a module worker; the bundler emits it as a separate asset.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

const TERRAIN = { source: 'dem', exaggeration: 1.6 } as const;
const PITCH = 50;

/**
 * Satellite imagery (Esri World Imagery: forests, fields, water are visible) with place labels.
 * Relief (Terrarium elevation tiles) is switched on only after the imagery has drawn, so the first
 * picture appears fast.
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
      maxzoom: 11,
      attribution: 'Terrain: Mapzen / AWS Terrain Tiles',
    },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.9 } },
  ],
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

/** public/geo/<id>.json written by scripts/export_geo.py. */
interface GeoFile {
  readonly typical: {
    readonly from: number;
    readonly to: number;
    readonly pts: readonly (readonly [number, number, number])[];
    readonly truncated: boolean;
  };
  readonly recent: Readonly<
    Record<
      string,
      { readonly pts: readonly (readonly [number, number, number])[]; readonly truncated: boolean }
    >
  >;
  readonly partial_month: string | null;
}

const geoCache = new Map<string, Promise<GeoFile | null>>();
function loadGeo(id: string): Promise<GeoFile | null> {
  let p = geoCache.get(id);
  if (!p) {
    p = fetch(`/geo/${encodeURIComponent(id)}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<GeoFile>) : null))
      .catch(() => null);
    geoCache.set(id, p);
  }
  return p;
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };
const toFc = (pts: readonly (readonly [number, number, number])[]) => ({
  type: 'FeatureCollection' as const,
  features: pts.map((p) => ({
    type: 'Feature' as const,
    properties: { v: p[2] },
    geometry: { type: 'Point' as const, coordinates: [p[0], p[1]] },
  })),
});

export type FireLayerState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'month'; month: string; count: number; truncated: boolean; partial: boolean }
  | { kind: 'typical'; from: number; to: number; count: number; truncated: boolean };

/**
 * 3D satellite map with relief and the places where fire was detected: for the selected month if
 * it is among the last 12, otherwise the typical (average) year. A click proposes a point for the
 * area form.
 */
export default function AoiMap({
  aoi,
  label,
  regionId,
  month,
  onLayer,
}: {
  aoi: CalendarResponse['aoi'];
  /** Area name in the current language. */
  label: string;
  /** Data-team region id for the fire layer (null for custom areas). */
  regionId: string | null;
  /** Selected month, YYYY-MM. */
  month: string | null;
  onLayer: (s: FireLayerState) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const setDraftPoint = useUi((s) => s.setDraftPoint);
  const [flat, setFlat] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; file: GeoFile | null } | null>(null);
  const M = useI18n().t.map;
  const report = useRef(onLayer);
  useEffect(() => {
    report.current = onLayer;
  });

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
      style: STYLE,
      bounds: aoi.bbox as [number, number, number, number],
      fitBoundsOptions: { padding: 40 },
      pitch: PITCH,
      maxPitch: 80,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      locale: M.controls,
    });
    m.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    m.on('load', () => {
      m.addSource('aoi', { type: 'geojson', data: outline(aoi) });
      m.addSource('fire', { type: 'geojson', data: EMPTY_FC });
      m.addLayer({
        id: 'aoi-casing',
        type: 'line',
        source: 'aoi',
        paint: { 'line-color': '#000000', 'line-width': 5, 'line-opacity': 0.45 },
      });
      m.addLayer({
        id: 'aoi-line',
        type: 'line',
        source: 'aoi',
        paint: { 'line-color': '#ffd2b8', 'line-width': 2 },
      });
      // Continent scale: heat. Country scale and closer: every hexagon as a glowing dot whose
      // size and colour grow with its fire-days, so even a handful of fires stays visible.
      m.addLayer({
        id: 'fire-heat',
        type: 'heatmap',
        source: 'fire',
        maxzoom: 5,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['ln', ['+', 1, ['get', 'v']]],
            0,
            0.2,
            5,
            1,
          ],
          'heatmap-intensity': 1.2,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 4, 16],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.9, 4.5, 0],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.15,
            '#781c6d',
            0.4,
            '#cf4446',
            0.7,
            '#ed6925',
            1,
            '#fcffa4',
          ],
        },
      });
      const size = (base: number) =>
        [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          ['*', base, ['interpolate', ['linear'], ['get', 'v'], 0.5, 2, 20, 4, 200, 7]],
          9,
          ['*', base, ['interpolate', ['linear'], ['get', 'v'], 0.5, 6, 20, 11, 200, 18]],
        ] as unknown as number;
      const colour = [
        'interpolate',
        ['linear'],
        ['get', 'v'],
        0.5,
        '#e8542a',
        5,
        '#f57c1f',
        30,
        '#fbb61a',
        150,
        '#fcffa4',
      ] as unknown as string;
      m.addLayer({
        id: 'fire-glow',
        type: 'circle',
        source: 'fire',
        paint: {
          'circle-radius': size(2.2),
          'circle-color': colour,
          'circle-blur': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.15, 4.5, 0.55],
        },
      });
      m.addLayer({
        id: 'fire-cells',
        type: 'circle',
        source: 'fire',
        paint: {
          'circle-radius': size(1),
          'circle-color': colour,
          'circle-stroke-color': '#2a0d02',
          'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.25, 4.5, 1],
        },
      });
      // Relief after the first full draw: the satellite picture shows up without waiting for it.
      m.once('idle', () => {
        if (m.getPitch() > 0) m.setTerrain(TERRAIN);
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
    // The map is created once per locale (keyed by the parent); changes are applied below.
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
        pitch: flat ? 0 : PITCH,
      });
    };
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoi]);

  // Fire layer file of the current region; "loading" is derived, not stored, while ids differ.
  useEffect(() => {
    if (!regionId) return;
    let alive = true;
    void loadGeo(regionId).then((file) => {
      if (alive) setLoaded({ id: regionId, file });
    });
    return () => {
      alive = false;
    };
  }, [regionId]);
  const geo: GeoFile | null | 'loading' = !regionId
    ? null
    : loaded?.id === regionId
      ? loaded.file
      : 'loading';

  const layer = useMemo<{ state: FireLayerState; pts: GeoFile['typical']['pts'] }>(() => {
    if (geo === 'loading') return { state: { kind: 'loading' }, pts: [] };
    if (!geo) return { state: { kind: 'none' }, pts: [] };
    const m = month ? geo.recent[month] : undefined;
    if (m) {
      return {
        state: {
          kind: 'month',
          month: month!,
          count: m.pts.length,
          truncated: m.truncated,
          partial: geo.partial_month === month,
        },
        pts: m.pts,
      };
    }
    const t = geo.typical;
    return {
      state: {
        kind: 'typical',
        from: t.from,
        to: t.to,
        count: t.pts.length,
        truncated: t.truncated,
      },
      pts: t.pts,
    };
  }, [geo, month]);

  useEffect(() => {
    report.current(layer.state);
    const m = map.current;
    if (!m) return;
    const apply = () =>
      (m.getSource('fire') as GeoJSONSource | undefined)?.setData(toFc(layer.pts));
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
  }, [layer]);

  const toggle3d = () => {
    const next = !flat;
    setFlat(next);
    map.current?.easeTo({ pitch: next ? 0 : PITCH, duration: 600 });
    map.current?.setTerrain(next ? null : TERRAIN);
  };

  return (
    <div className="relative">
      <div
        ref={container}
        className="border-line h-[26rem] w-full overflow-hidden rounded-xl border bg-[#0e1a24] lg:h-[32rem]"
        role="region"
        aria-label={M.aria(label)}
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
