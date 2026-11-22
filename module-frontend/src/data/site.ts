import type { BackendModule, HeroStat, NavItem } from '../types/site';
import { GITHUB_REPO_URL, githubBlobUrl } from '../lib/github';

export const SITE = {
  name: 'oracle-to-postgres',
  author: 'baileyseye',
  license: 'GPL-3.0',
  repoUrl: GITHUB_REPO_URL,
  readmeUrl: githubBlobUrl('README.md'),
  licenseUrl: githubBlobUrl('LICENSE'),
} as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'top', label: 'Обзор' },
  { id: 'why', label: 'Подход' },
  { id: 'architecture', label: 'Архитектура' },
  { id: 'pipeline', label: 'Пайплайн' },
  { id: 'modes', label: 'Режимы' },
  { id: 'types', label: 'Типы' },
  { id: 'api', label: 'API' },
  { id: 'start', label: 'Старт' },
];

export const NAV_SECTION_IDS: readonly string[] = NAV_ITEMS.map((item) => item.id);

export const HERO_STATS: readonly HeroStat[] = [
  {
    value: 4,
    label: 'Spring Boot модуля',
    detail: 'порты 8081–8084',
  },
  {
    value: 2,
    label: 'режима переноса',
    detail: 'initial-load / mirror',
  },
  {
    value: 5000,
    label: 'строк в keyset-странице',
    detail: 'migration.source.chunk-size',
  },
  {
    value: 10,
    label: 'строк в LOB-чанке',
    detail: 'migration.initial-load.lob-chunk-size',
  },
];

export const BACKEND_MODULES: readonly BackendModule[] = [
  { name: 'module-oracle', port: '8081' },
  { name: 'module-postgres', port: '8082' },
  { name: 'module-migration', port: '8083' },
  { name: 'module-schema-migration', port: '8084' },
];
