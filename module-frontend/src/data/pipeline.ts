import { PIPELINE_SNIPPETS } from './pipeline-snippets';
import type { PipelineStep } from '../types/pipeline';

export const PIPELINE_STEPS: readonly PipelineStep[] = [
  {
    id: 'plan',
    kicker: 'PLAN',
    title: 'План таблиц и FK-порядок',
    summary:
      'Строит план generic-таблиц по DatabaseMetaData, исключает users/orders ' +
      'и сортирует таблицы по зависимостям.',
    details: [
      'Учитывает include-tables, exclude-tables, table-mapping и column-mapping.',
      'Таблицы с одиночным integer PK идут через keyset; остальные — потоковым чтением.',
      'Parent-таблицы загружаются раньше child, чтобы не нарушить FK.',
    ],
    note:
      'План не создаёт схему. Все target-таблицы должны быть созданы Liquibase ' +
      'или module-schema-migration до запуска.',
    snippet: PIPELINE_SNIPPETS.plan,
  },
  {
    id: 'source-guard',
    kicker: 'SOURCE_CHECK',
    title: 'Preflight источника и SCN',
    summary:
      'Проверяет отсутствие активных пользовательских сессий в схеме источника ' +
      'и фиксирует SCN Oracle.',
    details: [
      'require-source-idle=true: активные USER-сессии дают 409 и останавливают запуск.',
      'SCN берётся через DBMS_FLASHBACK; fallback — CURRENT_SCN из v$database.',
      'Ошибка доступа к v$session возвращает 503, показывая, что источник недоступен.',
    ],
    note:
      'Без остановленных writers нельзя гарантировать snapshot. SCN фиксирует ' +
      'точку отсечения initial-load.',
    snippet: PIPELINE_SNIPPETS.sourceGuard,
  },
  {
    id: 'pre-load',
    kicker: 'PRE_LOAD_SQL',
    title: 'Pre-load SQL: снять вторичные ограничения',
    summary:
      'Идемпотентно снимает FK и unique перед COPY, чтобы не платить за проверки ' +
      'на каждой вставке. PK остаётся.',
    details: [
      'Скрипт задаётся через initial-load.pre-load-sql и выполняется InitialLoadScriptRunner.',
      'Для public используется public-pre-load.sql; для auto_migration — auto-migration-pre-load.sql.',
      'DROP CONSTRAINT IF EXISTS позволяет безопасно повторить шаг после падения.',
    ],
    note:
      'PK не удаляется: он нужен для идентификации и относительно дешёв при COPY. ' +
      'После загрузки ограничения возвращает post-load SQL.',
    snippet: PIPELINE_SNIPPETS.preLoad,
  },
  {
    id: 'users',
    kicker: 'USERS',
    title: 'users: keyset + COPY',
    summary:
      'Читает users keyset-страницами по id и пишет COPY с сохранением source id. ' +
      'Каждый чанк коммитится отдельно.',
    details: [
      'Диапазон MIN(id)..MAX(id) делится между workers; по умолчанию workers=4.',
      'Каждый worker читает WHERE id > ? AND id <= ? ORDER BY id с ROWNUM <= chunkSize.',
      'COPY получает явный список колонок с id; resume продолжает с MAX(id) в target.',
    ],
    note:
      'Source id сохраняются как есть. Это checkpoint initial-load и основа для ' +
      'последующего populate-mapping.',
    snippet: PIPELINE_SNIPPETS.usersCopy,
  },
  {
    id: 'orders',
    kicker: 'ORDERS',
    title: 'orders: COPY с user_id',
    summary:
      'Переносит orders после users, сохраняя id и source user_id. FK-порядок ' +
      'гарантирует, что пользователи уже в target.',
    details: [
      'Keyset-страницы по id и COPY с колонками id, user_id, order_number, amount, status, created_at.',
      'При truncate-target таблица очищается вместе с users и migration_entity_map.',
      'При resume загрузка продолжается с MAX(id) в target.',
    ],
    note:
      'В initial-load target-транзакция не одна: каждый COPY-чанк коммитится отдельно, ' +
      'поэтому упавшая загрузка не откатывает уже перенесённые строки.',
    snippet: PIPELINE_SNIPPETS.ordersCopy,
  },
  {
    id: 'generic',
    kicker: 'TABLES',
    title: 'Generic-таблицы и LOB',
    summary:
      'Остальные таблицы читаются по именам колонок; LOB-таблицы используют ' +
      'уменьшенный chunk, а не общий chunk-size.',
    details: [
      'По умолчанию include-tables содержит insurance_program_users; пустой список означает все таблицы.',
      'Keyset-таблицы идут через range-загрузку; остальные — потоковым чтением.',
      'Таблицы с LOB читаются чанком lob-chunk-size (по умолчанию 10).',
      'Для каждой generic-таблицы отдельно синхронизируются sequences и выполняется ANALYZE.',
    ],
    note:
      'Validation для BLOB проверяет count/null, но не побайтовый checksum. ' +
      'Критичные LOB требуют отдельной сверки.',
    snippet: PIPELINE_SNIPPETS.genericLoad,
  },
  {
    id: 'restart-sequences',
    kicker: 'FINALIZING',
    title: 'Identity и sequences',
    summary:
      'Сдвигает identity и nextval-sequences на MAX(id)+1, чтобы приложение могло ' +
      'вставлять новые строки после cutover.',
    details: [
      'Читает identity и nextval-колонки из information_schema.columns.',
      'Для identity выполняет ALTER COLUMN ... RESTART WITH next.',
      'Для обычных sequences выполняет setval(..., false), чтобы nextval вернул next.',
    ],
    note:
      'Без этого шага первая же вставка приложения может получить PK, который уже ' +
      'существует после COPY.',
    snippet: PIPELINE_SNIPPETS.restartSequences,
  },
  {
    id: 'populate-mapping',
    kicker: 'MAPPING',
    title: 'migration_entity_map',
    summary:
      'Опционально заполняет карту source_id = target_id, если после cutover ' +
      'планируется mirror-режим.',
    details: [
      'Управляется populate-mapping; по умолчанию false.',
      'Карта заполняется в одной транзакции после загрузки users/orders.',
      'При повторном запуске с непустой картой используется ON CONFLICT DO NOTHING.',
    ],
    note:
      'Включайте только при планируемом mirror. Если mirror не нужен, шаг экономит ' +
      'запись mapping-строк на весь объём таблиц.',
    optional: true,
    snippet: PIPELINE_SNIPPETS.populateMapping,
  },
  {
    id: 'post-load',
    kicker: 'POST_LOAD_SQL',
    title: 'Post-load SQL: вернуть ограничения',
    summary:
      'Восстанавливает unique и FK после COPY, валидирует FK отдельным шагом ' +
      'и настраивает maintenance_work_mem.',
    details: [
      'Для public используется public-post-load.sql; для auto_migration — auto-migration-post-load.sql.',
      'FK создаётся NOT VALID и затем VALIDATE CONSTRAINT, чтобы не блокировать загрузку.',
      'SET LOCAL maintenance_work_mem и max_parallel_maintenance_workers действуют в транзакции script runner.',
    ],
    note:
      'Скрипт должен быть идемпотентным: при resume он выполнится повторно после ' +
      'повторного pre-load.',
    snippet: PIPELINE_SNIPPETS.postLoad,
  },
  {
    id: 'validation',
    kicker: 'VALIDATION',
    title: 'Validation и gate на запуск',
    summary:
      'Сверяет counts, min/max/sum, длины, null-поля, orphan-FK и sequences. ' +
      'FAILED означает стоп.',
    details: [
      'Для users/orders проверяются count, minId, maxId, sumId, длины полей и null-поля.',
      'Для generic-таблиц — count, агрегаты, nulls и orphan-FK по внешним ключам.',
      'Sequence-проверка требует, чтобы last_value не отставал от MAX(id).',
      'При valid=false job получает FAILED; приложение нельзя открывать.',
    ],
    note:
      'Validation — последний gate перед cutover. Ошибку нельзя игнорировать: ' +
      'неполные или расходящиеся данные попадут в новую систему.',
    snippet: PIPELINE_SNIPPETS.validation,
  },
];
