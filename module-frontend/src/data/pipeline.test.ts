import { describe, expect, it } from 'vitest';
import { PIPELINE_STEPS } from './pipeline';
import {
  DEMO_TABLES,
  DEMO_TOTAL_ROWS,
  SIMULATION_EVENTS,
} from './simulation';

const EXPECTED_PHASES = [
  'plan',
  'source-guard',
  'pre-load',
  'users',
  'orders',
  'generic',
  'restart-sequences',
  'populate-mapping',
  'post-load',
  'validation',
];

describe('pipeline data', () => {
  it('keeps the declared initial-load order', () => {
    expect(PIPELINE_STEPS.map((step) => step.id)).toEqual(EXPECTED_PHASES);
  });

  it('provides a real snippet and explanation for every step', () => {
    for (const step of PIPELINE_STEPS) {
      const lines = step.snippet.code.split('\n').length;
      const expectedLines = step.snippet.endLine - step.snippet.startLine + 1;

      expect(lines).toBe(expectedLines);
      expect(step.snippet.code.length).toBeGreaterThan(0);
      expect(step.snippet.githubUrl).toContain('github.com/baileyseye');
      expect(step.details.length).toBeGreaterThan(0);
      expect(step.note.length).toBeGreaterThan(0);
    }
  });

  it('marks only populate-mapping as optional', () => {
    expect(
      PIPELINE_STEPS.filter((step) => step.optional).map((step) => step.id),
    ).toEqual(['populate-mapping']);
  });

  it('covers every phase in the simulation in order', () => {
    const phases = [...new Set(SIMULATION_EVENTS.map((event) => event.phaseId))];

    expect(phases).toEqual(EXPECTED_PHASES);
    expect(SIMULATION_EVENTS.at(-1)?.validationPassed).toBe(true);
    expect(SIMULATION_EVENTS.at(-1)?.log).toBe('VALIDATION PASSED');
  });
});

describe('demo dataset', () => {
  it('uses the seeded demo tables and total', () => {
    expect(DEMO_TABLES.map((table) => table.name)).toEqual([
      'users',
      'orders',
      'insurance_program_users',
    ]);
    expect(DEMO_TOTAL_ROWS).toBe(16);
  });
});
