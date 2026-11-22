import { describe, expect, it } from 'vitest';
import { API_SERVICES, API_STATUS_CODES, HEALTH_TARGETS } from './api';

describe('API catalog', () => {
  const endpoints = API_SERVICES.flatMap((service) => service.endpoints);
  const knownCodes = new Set(API_STATUS_CODES.map((status) => status.code));

  it('has unique method and path pairs', () => {
    const keys = endpoints.map(
      (endpoint) => `${endpoint.method} ${endpoint.path}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only documented response codes', () => {
    for (const endpoint of endpoints) {
      expect(endpoint.responseCodes).toContain(endpoint.successStatus);

      for (const code of endpoint.responseCodes) {
        expect(knownCodes.has(code)).toBe(true);
      }
    }
  });

  it('marks real mutating operations as dangerous', () => {
    const dangerous = endpoints
      .filter((endpoint) => endpoint.dangerous)
      .map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    expect(dangerous).toContain('POST /api/v1/migration/run');
    expect(dangerous).toContain('POST /api/v1/migration/run/async');
    expect(dangerous).toContain('POST /api/v1/schema-migration/apply');
  });

  it('covers all four health targets', () => {
    expect(HEALTH_TARGETS.map((target) => target.port)).toEqual([
      '8081',
      '8082',
      '8083',
      '8084',
    ]);
  });
});
