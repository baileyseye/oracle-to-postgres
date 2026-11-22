export type ApiMethod = 'GET' | 'POST';
export type ApiServiceId = 'migration' | 'schema-migration';

export interface ApiStatusCode {
  readonly code: number;
  readonly meaning: string;
}

export interface ApiEndpoint {
  readonly id: string;
  readonly service: ApiServiceId;
  readonly method: ApiMethod;
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly responseType: string;
  readonly successStatus: number;
  readonly responseCodes: readonly number[];
  readonly curl: string;
  readonly dangerous?: boolean;
  readonly sampleResponse?: unknown;
}

export interface ApiService {
  readonly id: ApiServiceId;
  readonly name: string;
  readonly port: string;
  readonly apiPrefix: string;
  readonly description: string;
  readonly endpoints: readonly ApiEndpoint[];
}

export interface HealthTarget {
  readonly id: string;
  readonly name: string;
  readonly port: string;
  readonly path: string;
}
