import { githubBlobUrl } from '../lib/github';
import type { PipelineCodeSnippet } from '../types/pipeline';

export const PIPELINE_SNIPPETS = {
  plan: {
    id: 'pipeline-plan',
    fileName: 'InitialLoadTablePlanBuilder.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/plan/InitialLoadTablePlanBuilder.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/plan/InitialLoadTablePlanBuilder.java',
    ),
    language: 'java',
    startLine: 53,
    endLine: 99,
    code: String.raw`    /**
     * Возвращает планы в порядке, безопасном для FK.
     */
    public List<InitialLoadTablePlan> buildPlans() {
        Set<String> include = lowerSet(properties.getIncludeTables());
        Set<String> exclude = lowerSet(properties.getExcludeTables());
        Set<String> targetTables = targetGateway.listTables().stream()
            .map(table -> table.toLowerCase(Locale.ROOT))
            .collect(java.util.stream.Collectors.toSet());

        Map<String, InitialLoadTablePlan> plansByTarget = new LinkedHashMap<>();

        for (String sourceTable : metadataProvider.listTables()) {
            String sourceLower = sourceTable.toLowerCase(Locale.ROOT);

            if (SPECIALIZED_TABLES.contains(sourceLower)) {
                continue;
            }

            if (!include.isEmpty() && !include.contains(sourceLower)) {
                continue;
            }

            if (exclude.contains(sourceLower)) {
                continue;
            }

            String targetTable = resolveTargetTable(sourceTable).toLowerCase(Locale.ROOT);

            if (!targetTables.contains(targetTable)) {
                throw new MigrationException("Target-таблица '" + targetTable
                    + "' для source-таблицы '" + sourceTable + "' не найдена");
            }

            InitialLoadTablePlan plan = buildPlan(sourceTable, targetTable);
            plansByTarget.put(targetTable, plan);
        }

        if (plansByTarget.isEmpty()) {
            return List.of();
        }

        List<InitialLoadTablePlan> ordered = orderByForeignKeys(plansByTarget);
        log.info("Generic initial-load: таблиц={}, порядок={}", ordered.size(),
            ordered.stream().map(InitialLoadTablePlan::targetTable).toList());
        return ordered;
    }`,
  },
  sourceGuard: {
    id: 'pipeline-source-guard',
    fileName: 'InitialLoadSourceGuard.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadSourceGuard.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadSourceGuard.java',
    ),
    language: 'java',
    startLine: 60,
    endLine: 125,
    code: String.raw`    /**
     * Выполняет preflight-проверку источника.
     */
    public SourceGuardResult check() {
        Boolean idle = null;

        if (initialLoadProperties.isRequireSourceIdle()) {
            requireIdleSource();
            idle = true;
        } else {
            log.warn("Проверка активных сессий Oracle отключена (require-source-idle=false)");
        }

        Long scn = initialLoadProperties.isCaptureSourceScn() ? captureScn() : null;

        if (scn != null) {
            log.info("SCN Oracle-источника на старте initial-load: {}", scn);
        }

        return new SourceGuardResult(scn, idle);
    }

    private void requireIdleSource() {
        String schema = normalizeSchema(sourceProperties.getSchema());
        String sql = schema == null ? ACTIVE_SESSIONS_CURRENT_SCHEMA_SQL : ACTIVE_SESSIONS_SQL;
        Object[] arguments = schema == null ? new Object[0] : new Object[]{schema};

        try {
            List<String> sessions = sourceJdbcTemplate.query(
                sql,
                (resultSet, rowNumber) -> "sid=" + resultSet.getLong("sid")
                    + ", serial=" + resultSet.getLong("serial#")
                    + ", user=" + resultSet.getString("username")
                    + ", program=" + resultSet.getString("program")
                    + ", machine=" + resultSet.getString("machine"),
                arguments);

            if (!sessions.isEmpty()) {
                throw new MigrationConflictException(
                    "В Oracle есть активные сессии в схеме источника: "
                        + String.join("; ", sessions)
                        + ". Остановите писателей или задайте require-source-idle=false.");
            }
        } catch (DataAccessException exception) {
            throw new SourceAccessException(
                "Не удалось проверить активные сессии Oracle (v$session). "
                    + "Нужны права на v$session или require-source-idle=false.", exception);
        }
    }

    private Long captureScn() {
        try {
            return sourceJdbcTemplate.queryForObject(
                "SELECT DBMS_FLASHBACK.GET_SYSTEM_CHANGE_NUMBER FROM dual", Long.class);
        } catch (DataAccessException flashbackException) {
            log.debug("DBMS_FLASHBACK.GET_SYSTEM_CHANGE_NUMBER недоступен: {}",
                flashbackException.getMessage());
        }

        try {
            return sourceJdbcTemplate.queryForObject("SELECT CURRENT_SCN FROM v$database", Long.class);
        } catch (DataAccessException databaseException) {
            log.warn("Не удалось получить SCN Oracle-источника: {}", databaseException.getMessage());
            return null;
        }
    }`,
  },
  usersCopy: {
    id: 'pipeline-users-copy',
    fileName: 'InitialLoadMigrationService.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java',
    ),
    language: 'java',
    startLine: 181,
    endLine: 200,
    code: String.raw`    private long loadUsers(MigrationRunContext context) {
        int chunkSize = Math.max(properties.getChunkSize(), 1);
        long startedAt = System.nanoTime();

        context.phase("USERS");
        TableRangeLoadSpec spec = new TableRangeLoadSpec(
            USERS_TABLE,
            USERS_TABLE,
            KEY_COLUMN,
            KEY_COLUMN,
            List.of("ID", "USERNAME", "EMAIL", "CREATED_AT", "UPDATED_AT"),
            chunkSize,
            loadGateway::maxKeyBetween,
            this::copyUserMaps);

        long total = parallelTableLoadService.load(spec, context);
        log.info("Первичная загрузка users завершена: {} строк за {} мс",
            total, millis(System.nanoTime() - startedAt));
        return total;
    }`,
  },
  ordersCopy: {
    id: 'pipeline-orders-copy',
    fileName: 'InitialLoadMigrationService.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java',
    ),
    language: 'java',
    startLine: 202,
    endLine: 221,
    code: String.raw`    private long loadOrders(MigrationRunContext context) {
        int chunkSize = Math.max(properties.getChunkSize(), 1);
        long startedAt = System.nanoTime();

        context.phase("ORDERS");
        TableRangeLoadSpec spec = new TableRangeLoadSpec(
            ORDERS_TABLE,
            ORDERS_TABLE,
            KEY_COLUMN,
            KEY_COLUMN,
            List.of("ID", "USER_ID", "ORDER_NUMBER", "AMOUNT", "STATUS", "CREATED_AT"),
            chunkSize,
            loadGateway::maxKeyBetween,
            this::copyOrderMaps);

        long total = parallelTableLoadService.load(spec, context);
        log.info("Первичная загрузка orders завершена: {} строк за {} мс",
            total, millis(System.nanoTime() - startedAt));
        return total;
    }`,
  },
  preLoad: {
    id: 'pipeline-pre-load',
    fileName: 'public-pre-load.sql',
    filePath:
      'module-migration/src/main/resources/initial-load/public-pre-load.sql',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/resources/initial-load/public-pre-load.sql',
    ),
    language: 'sql',
    startLine: 1,
    endLine: 6,
    code: String.raw`-- initial-load: снятие вторичных ограничений public-схемы.
-- PK не трогаем: он нужен для идентификации и относительно дешёв при COPY.
ALTER TABLE IF EXISTS "public"."orders" DROP CONSTRAINT IF EXISTS "fk_orders_user";
ALTER TABLE IF EXISTS "public"."orders" DROP CONSTRAINT IF EXISTS "uk_orders_order_number";
ALTER TABLE IF EXISTS "public"."users" DROP CONSTRAINT IF EXISTS "uk_users_username";
ALTER TABLE IF EXISTS "public"."users" DROP CONSTRAINT IF EXISTS "uk_users_email";`,
  },
  genericLoad: {
    id: 'pipeline-generic-load',
    fileName: 'GenericInitialLoadService.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/GenericInitialLoadService.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/GenericInitialLoadService.java',
    ),
    language: 'java',
    startLine: 71,
    endLine: 94,
    code: String.raw`    /**
     * Загружает все generic-таблицы.
     */
    public List<TableLoadResult> load(List<InitialLoadTablePlan> plans, MigrationRunContext context) {
        List<TableLoadResult> results = new ArrayList<>();

        for (InitialLoadTablePlan plan : plans) {
            context.phase("TABLES");
            long rows = plan.keyset()
                ? loadKeyset(plan, context)
                : loadStreaming(plan, context);

            targetGateway.restartSequences(plan.targetTable());

            if (properties.isAnalyze()) {
                targetGateway.analyze(plan.targetTable());
            }

            context.tableCompleted();
            results.add(new TableLoadResult(plan.targetTable(), rows));
        }

        return results;
    }`,
  },
  restartSequences: {
    id: 'pipeline-restart-sequences',
    fileName: 'GenericInitialLoadTargetGateway.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/GenericInitialLoadTargetGateway.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/GenericInitialLoadTargetGateway.java',
    ),
    language: 'java',
    startLine: 133,
    endLine: 171,
    code: String.raw`    /**
     * Синхронизирует identity и nextval-default sequences таблицы после загрузки.
     */
    public void restartSequences(String table) {
        String schemaFilter = schema == null || schema.isBlank() ? null : schema;
        List<SequenceColumn> columns = targetJdbcTemplate.query(
            "SELECT column_name, column_default, is_identity"
                + " FROM information_schema.columns"
                + " WHERE table_schema = COALESCE(?, current_schema()) AND table_name = ?"
                + " AND (is_identity = 'YES' OR column_default LIKE 'nextval(%')"
                + " ORDER BY ordinal_position",
            (resultSet, rowNumber) -> new SequenceColumn(
                resultSet.getString("column_name"),
                resultSet.getString("column_default"),
                "YES".equalsIgnoreCase(resultSet.getString("is_identity"))),
            schemaFilter, table.toLowerCase(Locale.ROOT));

        for (SequenceColumn column : columns) {
            long max = maxKey(table, column.columnName());
            long next = max == Long.MIN_VALUE ? 1 : max + 1;

            if (column.identity()) {
                targetJdbcTemplate.execute("ALTER TABLE " + qualifiedTable(table)
                    + " ALTER COLUMN " + quote(column.columnName()) + " RESTART WITH " + next);
                continue;
            }

            String sequence = parseSequence(column.defaultValue());

            if (sequence == null) {
                log.warn("Не удалось разобрать sequence default '{}' для {}.{}",
                    column.defaultValue(), table, column.columnName());
                continue;
            }

            targetJdbcTemplate.queryForObject(
                "SELECT setval(?::regclass, ?, false)", Long.class, sequence, next);
        }
    }`,
  },
  populateMapping: {
    id: 'pipeline-populate-mapping',
    fileName: 'InitialLoadTargetGateway.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/InitialLoadTargetGateway.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/InitialLoadTargetGateway.java',
    ),
    language: 'java',
    startLine: 153,
    endLine: 185,
    code: String.raw`    /**
     * Заполняет служебную карту для последующего mirror-режима.
     * <br>
     * При сохранении source id соответствие тривиально: source_id = target_id.
     */
    public void populateMapping(boolean mappingEmpty) {
        if (!tableExists(MAPPING_TABLE)) {
            throw new TargetAccessException("Таблица migration_entity_map отсутствует. "
                + "Создайте схему или отключите populate-mapping.");
        }

        String conflictClause = mappingEmpty
            ? ""
            : " ON CONFLICT (entity_type, source_id) DO NOTHING";

        try {
            targetTransactionTemplate.executeWithoutResult(status -> {
                targetJdbcTemplate.update(
                    "INSERT INTO " + mappingTable
                        + " (entity_type, source_id, target_id, source_key, last_seen_run, updated_at)"
                        + " SELECT 'USER', id, id, username, NULL, CURRENT_TIMESTAMP FROM " + usersTable
                        + conflictClause);

                targetJdbcTemplate.update(
                    "INSERT INTO " + mappingTable
                        + " (entity_type, source_id, target_id, source_key, last_seen_run, updated_at)"
                        + " SELECT 'ORDER', id, id, order_number, NULL, CURRENT_TIMESTAMP FROM " + ordersTable
                        + conflictClause);
            });
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось заполнить migration_entity_map", exception);
        }
    }`,
  },
  postLoad: {
    id: 'pipeline-post-load',
    fileName: 'public-post-load.sql',
    filePath:
      'module-migration/src/main/resources/initial-load/public-post-load.sql',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/resources/initial-load/public-post-load.sql',
    ),
    language: 'sql',
    startLine: 1,
    endLine: 11,
    code: String.raw`-- initial-load: восстановление ограничений public-схемы после COPY.
-- FK создаётся NOT VALID и затем валидируется отдельным шагом.
-- Tune под железо; SET LOCAL действует в транзакции script runner.
SET LOCAL maintenance_work_mem = '512MB';
SET LOCAL max_parallel_maintenance_workers = 4;
ALTER TABLE "public"."users" ADD CONSTRAINT "uk_users_username" UNIQUE ("username");
ALTER TABLE "public"."users" ADD CONSTRAINT "uk_users_email" UNIQUE ("email");
ALTER TABLE "public"."orders" ADD CONSTRAINT "uk_orders_order_number" UNIQUE ("order_number");
ALTER TABLE "public"."orders" ADD CONSTRAINT "fk_orders_user"
  FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") NOT VALID;
ALTER TABLE "public"."orders" VALIDATE CONSTRAINT "fk_orders_user";`,
  },
  validation: {
    id: 'pipeline-validation',
    fileName: 'GenericInitialLoadValidationService.java',
    filePath:
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/GenericInitialLoadValidationService.java',
    githubUrl: githubBlobUrl(
      'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/GenericInitialLoadValidationService.java',
    ),
    language: 'java',
    startLine: 59,
    endLine: 101,
    code: String.raw`    public MigrationValidationReport validate(List<InitialLoadTablePlan> plans) {
        List<ValidationCheck> checks = new ArrayList<>();

        for (InitialLoadTablePlan plan : plans) {
            validateTable(plan, checks);
            validateForeignKeys(plan, checks);
        }

        boolean valid = checks.stream().allMatch(ValidationCheck::passed);

        if (valid) {
            log.info("Generic validation пройдена: таблиц={}, проверок={}", plans.size(), checks.size());
        } else {
            log.error("Generic validation не пройдена: {}", checks.stream()
                .filter(check -> !check.passed())
                .map(check -> check.name() + " source=" + check.sourceValue()
                    + " target=" + check.targetValue())
                .toList());
        }

        return new MigrationValidationReport(valid, checks);
    }

    private void validateTable(InitialLoadTablePlan plan, List<ValidationCheck> checks) {
        String sourceTable = metadataProvider.qualifiedTableName(plan.sourceTable());
        String targetTable = qualifiedTable(plan.targetTable());
        List<Aggregate> sourceAggregates = aggregates(plan, true);
        List<Aggregate> targetAggregates = aggregates(plan, false);

        TableStats source = stats(sourceJdbcTemplate, sourceTable, sourceAggregates, true);
        TableStats target = stats(targetJdbcTemplate, targetTable, targetAggregates, false);

        checks.add(check(plan.targetTable() + ".count", source.count(), target.count(),
            source.count() == target.count()));

        for (Aggregate aggregate : sourceAggregates) {
            BigDecimal sourceValue = source.values().get(aggregate.name());
            BigDecimal targetValue = target.values().get(aggregate.name());
            boolean passed = equalDecimal(sourceValue, targetValue);

            checks.add(check(plan.targetTable() + "." + aggregate.name(), sourceValue, targetValue, passed));
        }
    }`,
  },
} as const satisfies Record<string, PipelineCodeSnippet>;
