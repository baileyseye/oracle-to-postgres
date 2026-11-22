/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORACLE_BASE?: string;
  readonly VITE_POSTGRES_BASE?: string;
  readonly VITE_MIGRATION_BASE?: string;
  readonly VITE_SCHEMA_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
