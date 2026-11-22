export interface NavItem {
  readonly id: string;
  readonly label: string;
}

export interface HeroStat {
  readonly value: number;
  readonly label: string;
  readonly detail: string;
}

export interface BackendModule {
  readonly name: string;
  readonly port: string;
}
