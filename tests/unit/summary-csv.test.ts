import { describe, expect, it } from 'vitest';
import type { CalendarResponse } from '@/lib/api/types';
import { buildCalendar } from '@/lib/domain/calendar';
import { summaryCsv } from '@/server/services/calendar-service';
import { TODAY, contractMeta } from '../fixtures/meta';

function response(): CalendarResponse {
  const rows = [];
  for (let y = 2001; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 11) continue;
      rows.push({
        year: y,
        month: m,
        harm: 10 + m,
        harmLo: 9,
        harmHi: 30,
        rawModis: 3,
        rawViirs: 4,
      });
    }
  }
  return {
    aoi: {
      kind: 'region',
      id: 'ZZB',
      label: 'Mock',
      bbox: [0, 0, 1, 1],
      ring: null,
      cellsCount: 1,
      areaKm2: null,
      resolution: 6,
      coarse: false,
    },
    dataset: {
      version: contractMeta.dataset_version,
      isMock: true,
      source: 'local_fixture',
      hasRaw: true,
      hasRange: true,
      unit: 'harmonized fire-days',
      standardProcessingThrough: contractMeta.standard_processing_through,
      nrtThrough: contractMeta.nrt_through,
      baselineYears: contractMeta.harmonization.baseline_years,
      estimateBeforeYear: contractMeta.estimate_before_year,
      method: contractMeta.harmonization.method,
      coverage: contractMeta.coverage,
    },
    today: TODAY,
    calendar: buildCalendar(rows, contractMeta, TODAY),
    forecast: null,
  };
}

describe('summaryCsv() (science review M4)', () => {
  const lines = summaryCsv(response()).trim().split('\n');
  const cols = lines[0]!.split(',');
  const row = (y: number, m: number) => {
    const line = lines.find((l) => l.startsWith(`${y},${m},`));
    return line ? Object.fromEntries(line.split(',').map((v, i) => [cols[i], v])) : null;
  };

  it('names units and carries the dataset version and the baseline used', () => {
    expect(cols).toEqual(
      expect.arrayContaining([
        'harmonized_fire_days',
        'raw_modis_detections',
        'raw_viirs_detections',
        'percentile_rank',
        'dataset_version',
        'baseline_n',
        'baseline_from',
        'baseline_to',
        'baseline_estimate_years',
        'status',
      ]),
    );
    expect(row(2015, 7)).toMatchObject({
      dataset_version: 'mock-2026-11-15a',
      baseline_n: '22',
      baseline_from: '2003',
      baseline_to: '2025',
      baseline_estimate_years: '9',
    });
  });

  it('a no_data row has empty values, never 0', () => {
    expect(row(2000, 3)).toMatchObject({
      status: 'no_data',
      harmonized_fire_days: '',
      raw_modis_detections: '',
    });
  });

  it('a partial month has a value, no ratio and the reason', () => {
    expect(row(2026, 11)).toMatchObject({
      harmonized_fire_days: '21',
      ratio_to_median: '',
      observed_days: '14',
      note: 'partial month: 14 of 30 days observed',
    });
  });

  it('future months are not exported', () => {
    expect(row(2026, 12)).toBeNull();
  });
});
