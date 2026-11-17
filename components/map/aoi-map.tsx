'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Map as MapLibre,
  Marker,
  NavigationControl,
  Popup,
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
interface Layer {
  readonly pts: readonly (readonly [number, number, number])[];
  readonly truncated: boolean;
}
/** public/geo/<id>/index.json: the typical year and which recent months have their own file. */
interface GeoIndex {
  readonly typical: Layer & { readonly from: number; readonly to: number };
  readonly months: readonly string[];
  readonly partial_month: string | null;
}

/** Small JSON files from the CDN, fetched once per page view and shared by every map instance. */
const cache = new Map<string, Promise<unknown>>();
function loadJson<T>(path: string): Promise<T | null> {
  let p = cache.get(path) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(path)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null);
    cache.set(path, p);
  }
  return p;
}
const geoBase = (id: string) => `/geo/${encodeURIComponent(id)}`;

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };
const toFc = (pts: readonly (readonly [number, number, number])[]) => ({
  type: 'FeatureCollection' as const,
  features: pts.map((p) => ({
    type: 'Feature' as const,
    properties: { v: p[2] },
    geometry: { type: 'Point' as const, coordinates: [p[0], p[1]] },
  })),
});

type Pt = readonly [number, number, number];

export type FireLayerState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | {
      kind: 'month';
      month: string;
      count: number;
      truncated: boolean;
      partial: boolean;
      top: readonly Pt[];
    }
  | {
      kind: 'typical';
      from: number;
      to: number;
      count: number;
      truncated: boolean;
      top: readonly Pt[];
    };

/** A point to fly to; `n` changes on every request so the same place can be revisited. */
export interface MapFocus {
  readonly lon: number;
  readonly lat: number;
  readonly n: number;
}

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
  focus,
}: {
  aoi: CalendarResponse['aoi'];
  /** Area name in the current language. */
  label: string;
  /** Data-team region id for the fire layer (null for custom areas). */
  regionId: string | null;
  /** Selected month, YYYY-MM. */
  month: string | null;
  onLayer: (s: FireLayerState) => void;
  focus?: MapFocus | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const setDraftPoint = useUi((s) => s.setDraftPoint);
  const [flat, setFlat] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; file: GeoIndex | null } | null>(null);
  const M = useI18n().t.map;
  const report = useRef(onLayer);
  const i18n = useI18n();
  const popupText = useRef((v: number) => M.popup(i18n.n(v)));
  useEffect(() => {
    report.current = onLayer;
    popupText.current = (v: number) => M.popup(i18n.n(v));
  });

  const marker = useRef<Marker | null>(null);
  useEffect(() => {
    if (!focus || !map.current) return;
    // A ring that stays visible on top of the relief marks the place we flew to.
    if (!marker.current) {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'width:30px;height:30px;border-radius:999px;border:3px solid #fcffa4;box-shadow:0 0 0 3px #e0561c,0 0 18px 6px rgba(255,113,54,.65);background:rgba(255,113,54,.25)';
      marker.current = new Marker({ element: el });
    }
    marker.current.setLngLat([focus.lon, focus.lat]).addTo(map.current);
    map.current.flyTo({
      center: [focus.lon, focus.lat],
      zoom: 8.5,
      pitch: flat ? 0 : PITCH,
      duration: 1600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

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
      // A click on a fire dot explains it; anywhere else proposes a point for a custom area.
      const hit = m.queryRenderedFeatures(e.point, { layers: ['fire-cells'] })[0];
      const v = hit?.properties?.v as number | undefined;
      if (hit && v !== undefined) {
        new Popup({ closeButton: true, maxWidth: '240px' })
          .setLngLat(e.lngLat)
          .setText(popupText.current(v))
          .addTo(m);
        return;
      }
      const p = e.lngLat.wrap();
      setDraftPoint({ lat: p.lat, lon: p.lng });
    });
    m.on('mouseenter', 'fire-cells', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'fire-cells', () => (m.getCanvas().style.cursor = ''));
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

  // Index of the current region, then the file of the selected month only. "Loading" is derived
  // from which ids are loaded, not stored, so no state is set synchronously inside an effect.
  useEffect(() => {
    if (!regionId) return;
    let alive = true;
    void loadJson<GeoIndex>(`${geoBase(regionId)}/index.json`).then((file) => {
      if (alive) setLoaded({ id: regionId, file });
    });
    return () => {
      alive = false;
    };
  }, [regionId]);
  const geo: GeoIndex | null | 'loading' = !regionId
    ? null
    : loaded?.id === regionId
      ? loaded.file
      : 'loading';

  const monthKey =
    regionId && month && geo && geo !== 'loading' && geo.months.includes(month)
      ? `${regionId}/${month}`
      : null;
  const [monthLoaded, setMonthLoaded] = useState<{ key: string; file: Layer | null } | null>(null);
  useEffect(() => {
    if (!monthKey) return;
    let alive = true;
    void loadJson<Layer>(`${geoBase(monthKey.split('/')[0]!)}/${monthKey.split('/')[1]}.json`).then(
      (file) => {
        if (alive) setMonthLoaded({ key: monthKey, file });
      },
    );
    return () => {
      alive = false;
    };
  }, [monthKey]);

  const layer = useMemo<{ state: FireLayerState; pts: Layer['pts'] }>(() => {
    if (geo === 'loading') return { state: { kind: 'loading' }, pts: [] };
    if (!geo) return { state: { kind: 'none' }, pts: [] };
    if (monthKey) {
      if (monthLoaded?.key !== monthKey) return { state: { kind: 'loading' }, pts: [] };
      const m = monthLoaded.file;
      if (m) {
        return {
          state: {
            kind: 'month',
            month: month!,
            count: m.pts.length,
            truncated: m.truncated,
            partial: geo.partial_month === month,
            top: m.pts.slice(0, 5),
          },
          pts: m.pts,
        };
      }
    }
    const t = geo.typical;
    return {
      state: {
        kind: 'typical',
        from: t.from,
        to: t.to,
        count: t.pts.length,
        truncated: t.truncated,
        top: t.pts.slice(0, 5),
      },
      pts: t.pts,
    };
  }, [geo, month, monthKey, monthLoaded]);

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
