import { githubBlobUrl } from '../lib/github';
import type { CodeModule } from '../types/code';

export const CODE_MODULES: readonly CodeModule[] = [
  {
    id: 'migration',
    label: 'module-migration',
    port: '8083',
    summary:
      'Data migration: initial-load, mirror, async jobs и schema diff.',
    files: [
      {
        id: 'initial-load-migration-service',
        name: 'InitialLoadMigrationService.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java',
        ),
        language: 'java',
        summary:
          'Оркестратор initial-load: source guard, pre/post SQL, COPY, validation и mapping.',
        snippets: [
          {
            id: 'initial-load-migration-service-snip',
            title: 'migrateAll()',
            startLine: 53,
            endLine: 145,
            note:
              'Полный initial-load: sourceGuard → pre-load.sql → users/orders через parallel COPY → generic tables → restartSequences → post-load.sql → validation. FAILED останавливает cutover.',
            code: String.raw`    /**
     * Выполняет первичную загрузку users, затем orders.
     */
    public MigrationReport migrateAll(MigrationRunContext context) {
        LocalDateTime startedAt = LocalDateTime.now();

        log.info("Первичная загрузка: chunkSize={}, truncateTarget={}, resume={}, populateMapping={}, "
                + "validate={}, requireSourceIdle={}",
            properties.getChunkSize(), properties.isTruncateTarget(), properties.isResume(),
            properties.isPopulateMapping(), properties.isValidate(), properties.isRequireSourceIdle());

        targetGateway.requireTable(USERS_TABLE);
        targetGateway.requireTable(ORDERS_TABLE);

        if (properties.isPopulateMapping()) {
            targetGateway.requireMappingTable();
        }

        List<InitialLoadTablePlan> genericPlans = planBuilder.buildPlans();
        context.tablesTotal(2 + genericPlans.size());

        context.phase("SOURCE_CHECK");
        SourceGuardResult sourceGuardResult = sourceGuard.check();
        context.sourceScn(sourceGuardResult.scn());
        context.sourceIdle(sourceGuardResult.idle());

        context.phase("PRE_LOAD_SQL");
        scriptRunner.runPreLoad(properties.getPreLoadSql());

        context.phase("PREPARE_TARGET");
        genericInitialLoadService.prepare(genericPlans);
        loadGateway.prepareTarget(properties.isTruncateTarget(), properties.isResume());

        long usersRead = loadUsers(context);
        context.tableCompleted();
        long ordersRead = loadOrders(context);
        context.tableCompleted();

        context.phase("TABLES");
        List<TableLoadResult> genericResults = genericInitialLoadService.load(genericPlans, context);

        context.phase("FINALIZING");
        genericLoadGateway.restartSequences(USERS_TABLE);
        genericLoadGateway.restartSequences(ORDERS_TABLE);

        context.phase("POST_LOAD_SQL");
        scriptRunner.runPostLoad(properties.getPostLoadSql());

        MigrationValidationReport validation = null;

        if (properties.isValidate()) {
            context.phase("VALIDATION");
            validation = mergeValidation(
                validationService.validate(),
                genericValidationService.validate(genericPlans));
        }

        if (validation != null && !validation.valid()) {
            MigrationReport failedReport = buildReport(
                startedAt, usersRead, ordersRead, genericResults, sourceGuardResult, validation);

            throw new MigrationValidationException("Validation initial-load не пройдена. "
                + "Target нельзя открывать приложению.", failedReport);
        }

        if (properties.isPopulateMapping()) {
            context.phase("MAPPING");
            boolean mappingEmpty = properties.isTruncateTarget() || !properties.isResume();
            loadGateway.populateMapping(mappingEmpty);
        }

        if (properties.isAnalyze()) {
            context.phase("ANALYZE");
            loadGateway.analyze(USERS_TABLE);
            loadGateway.analyze(ORDERS_TABLE);
        }

        if (properties.isVacuum()) {
            context.phase("VACUUM");
            genericLoadGateway.vacuum(USERS_TABLE);
            genericLoadGateway.vacuum(ORDERS_TABLE);

            for (InitialLoadTablePlan plan : genericPlans) {
                genericLoadGateway.vacuum(plan.targetTable());
            }
        }

        MigrationReport report = buildReport(
            startedAt, usersRead, ordersRead, genericResults, sourceGuardResult, validation);

        log.info("Первичная загрузка Oracle → PostgreSQL завершена: {}", report);
        return report;
    }`,
          },
        ],
      },
      {
        id: 'initial-load-source-guard',
        name: 'InitialLoadSourceGuard.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadSourceGuard.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadSourceGuard.java',
        ),
        language: 'java',
        summary:
          'Preflight Oracle: активные сессии в схеме источника и захват SCN.',
        snippets: [
          {
            id: 'initial-load-source-guard-snip',
            title: 'check() · requireIdleSource() · captureScn()',
            startLine: 60,
            endLine: 125,
            note:
              'Если require-source-idle=true, активные USER-сессии в схеме источника дают 409. SCN берётся из DBMS_FLASHBACK, fallback — v$database.CURRENT_SCN.',
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
        ],
      },
      {
        id: 'chunk-retry-executor',
        name: 'ChunkRetryExecutor.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/ChunkRetryExecutor.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/ChunkRetryExecutor.java',
        ),
        language: 'java',
        summary:
          'Retry/backoff COPY-чанков только для transient-ошибок.',
        snippets: [
          {
            id: 'chunk-retry-executor-snip',
            title: 'execute() · isRetryable() · isTransientSqlState()',
            startLine: 30,
            endLine: 93,
            note:
              'Повтор с exponential backoff только для SQLState 08/40/53 и 57P01–57P03. Нарушения unique/FK/CHECK и прикладные исключения не ретраятся.',
            code: String.raw`    public void execute(String operation, Runnable action) {
        execute(operation, () -> {
            action.run();
            return null;
        });
    }

    public <T> T execute(String operation, Supplier<T> action) {
        int maxAttempts = Math.max(properties.getRetryMaxAttempts(), 1);
        long backoff = Math.max(properties.getRetryInitialBackoffMs(), 0);
        long maxBackoff = Math.max(properties.getRetryMaxBackoffMs(), backoff);

        for (int attempt = 1; ; attempt++) {
            try {
                return action.get();
            } catch (RuntimeException exception) {
                if (attempt >= maxAttempts || !isRetryable(exception)) {
                    throw exception;
                }

                log.warn("Операция '{}' не удалась (попытка {}/{}), повтор через {} мс: {}",
                    operation, attempt, maxAttempts, backoff, exception.getMessage());

                sleep(backoff);
                backoff = Math.min(backoff * 2, maxBackoff);
            }
        }
    }

    private boolean isRetryable(Throwable throwable) {
        for (Throwable cause = throwable; cause != null; cause = cause.getCause()) {
            if (cause instanceof MigrationValidationException
                || cause instanceof MigrationCancelledException
                || cause instanceof MigrationConflictException
                || cause instanceof DataIntegrityViolationException
                || cause instanceof BadSqlGrammarException) {
                return false;
            }

            if (cause instanceof TransientDataAccessException
                || cause instanceof RecoverableDataAccessException) {
                return true;
            }

            if (cause instanceof SQLException sqlException && isTransientSqlState(sqlException.getSQLState())) {
                return true;
            }
        }

        return false;
    }

    private boolean isTransientSqlState(String sqlState) {
        if (sqlState == null) {
            return false;
        }

        return sqlState.startsWith("08")
            || sqlState.startsWith("40")
            || sqlState.startsWith("53")
            || "57P01".equals(sqlState)
            || "57P02".equals(sqlState)
            || "57P03".equals(sqlState);
    }`,
          },
        ],
      },
      {
        id: 'migration-job-manager',
        name: 'MigrationJobManager.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/MigrationJobManager.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/MigrationJobManager.java',
        ),
        language: 'java',
        summary:
          'Async job: запуск, прогресс, отмена и хранение состояния в памяти.',
        snippets: [
          {
            id: 'migration-job-manager-snip',
            title: 'start() · get() · cancel() · execute()',
            startLine: 44,
            endLine: 124,
            note:
              '202 + jobId, один активный job на процесс, отмена initial-load между чанками. Mirror и финальные фазы отменить нельзя — 409.',
            code: String.raw`    /**
     * Запускает миграцию в фоне и возвращает начальное состояние job.
     */
    public MigrationJobResponse start() {
        if (migrationRunService.isRunning()) {
            throw new MigrationConflictException("Уже выполняется другой запуск миграции");
        }

        MigrationJobState job = new MigrationJobState(
            UUID.randomUUID().toString(), migrationRunService.mode());

        if (!activeJob.compareAndSet(null, job)) {
            throw new MigrationConflictException("Уже выполняется другой запуск миграции");
        }

        cleanupFinishedJobs();
        jobs.put(job.jobId(), job);

        try {
            taskExecutor.execute(() -> execute(job));
        } catch (TaskRejectedException exception) {
            activeJob.compareAndSet(job, null);
            jobs.remove(job.jobId());
            throw new MigrationException(
                "Не удалось поставить job миграции в очередь", exception);
        }

        return job.toResponse();
    }

    /**
     * Возвращает состояние job.
     */
    public MigrationJobResponse get(String jobId) {
        return find(jobId).toResponse();
    }

    /**
     * Запрашивает отмену initial-load job между чанками.
     */
    public MigrationJobResponse cancel(String jobId) {
        MigrationJobState job = find(jobId);

        if (job.mode() == MigrationMode.MIRROR) {
            throw new MigrationConflictException("Отмена mirror-режима не поддерживается: "
                + "он выполняется в одной транзакции");
        }

        if (job.status() != MigrationJobStatus.RUNNING) {
            throw new MigrationConflictException("Job уже завершён со статусом " + job.status());
        }

        if ("FINALIZING".equals(job.phase()) || "POST_LOAD_SQL".equals(job.phase())
            || "VALIDATION".equals(job.phase()) || "ANALYZE".equals(job.phase())) {
            throw new MigrationConflictException("Отмена невозможна: загрузка уже завершена, "
                + "идёт финализация job");
        }

        job.requestCancel();
        return job.toResponse();
    }

    private void execute(MigrationJobState job) {
        try {
            job.phase("STARTING");
            MigrationReport report = migrationRunService.run(new MigrationRunContext(job));
            job.complete(report);
            log.info("Job миграции {} завершён: {}", job.jobId(), report);
        } catch (MigrationCancelledException exception) {
            job.cancel();
            log.warn("Job миграции {} отменён", job.jobId());
        } catch (MigrationValidationException exception) {
            job.fail(exception, exception.getReport());
            log.error("Job миграции {} не прошёл validation: {}", job.jobId(), exception.getMessage());
        } catch (Throwable throwable) {
            job.fail(throwable, null);
            log.error("Job миграции {} завершился ошибкой", job.jobId(), throwable);
        } finally {
            activeJob.compareAndSet(job, null);
        }
    }`,
          },
        ],
      },
      {
        id: 'user-migration-service',
        name: 'UserMigrationService.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/UserMigrationService.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/UserMigrationService.java',
        ),
        language: 'java',
        summary:
          'Mirror users: keyset-страницы, staging и stale-удаление.',
        snippets: [
          {
            id: 'user-migration-service-snip',
            title: 'migrate() · deleteStaleUsers()',
            startLine: 39,
            endLine: 92,
            note:
              'Keyset-страницы по id, staging и set-based apply на каждый чанк. Stale users удаляются после orders, чтобы не нарушить FK.',
            code: String.raw`    public UserMigrationResult migrate(long runId) {
        targetGateway.requireTable(TABLE);
        targetGateway.requireMappingTable();
        chunkGateway.prepareUserStaging();

        int chunkSize = Math.max(properties.getChunkSize(), 1);
        long lastSourceId = Long.MIN_VALUE;
        long total = 0;
        long inserted = 0;
        long updated = 0;

        while (true) {
            List<Map<String, Object>> rows = rowReader.readRowsAfter(
                TABLE, KEY_COLUMN, lastSourceId, chunkSize);

            if (rows.isEmpty()) {
                break;
            }

            List<UserRow> chunk = rows.stream().map(rowMapper::toUser).toList();
            total += chunk.size();

            chunkGateway.stageUsers(chunk);
            ChunkResult result = chunkGateway.applyUserChunk(runId);
            inserted += result.inserted();
            updated += result.updated();

            long nextSourceId = chunk.getLast().sourceId();

            if (nextSourceId <= lastSourceId) {
                throw new MigrationException("Keyset-чтение users не продвинулось: "
                    + lastSourceId + " → " + nextSourceId);
            }

            lastSourceId = nextSourceId;

            if (rows.size() < chunkSize) {
                break;
            }
        }

        log.info("Зеркальный перенос пользователей завершён: всего={}, вставлено={}, обновлено={}",
            total, inserted, updated);

        return new UserMigrationResult(total, inserted, updated);
    }

    /**
     * Удаляет из PostgreSQL пользователей, которые ранее были перенесены,
     * но исчезли из Oracle. Вызывается после удаления устаревших заказов.
     */
    public long deleteStaleUsers(long runId) {
        return chunkGateway.deleteStaleUsers(runId);
    }`,
          },
        ],
      },
      {
        id: 'postgres-chunk-gateway',
        name: 'PostgresChunkGateway.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/PostgresChunkGateway.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/PostgresChunkGateway.java',
        ),
        language: 'java',
        summary:
          'Set-based SQL зеркала: update, adoption, insert, mapping и last_seen_run.',
        snippets: [
          {
            id: 'postgres-chunk-gateway-snip',
            title: 'applyUserChunk()',
            startLine: 96,
            endLine: 147,
            note:
              'Set-based SQL: update mapped → adoption по username → insert new → заполнение карты → mark seen. Никаких полных карт в Java.',
            code: String.raw`    /**
     * Применяет staging-чанк пользователей к целевой таблице.
     * <br>
     * Порядок шагов: сначала обновляются сопоставленные строки,
     * затем удаляются битые соответствия, затем выполняется adoption
     * по username, вставка новых строк и фиксация source id в текущем запуске.
     */
    public ChunkResult applyUserChunk(long runId) {
        try {
            deleteOrphanUserMappings();

            long updated = targetJdbcTemplate.update(
                "UPDATE " + usersTable + " u"
                    + " SET username = s.username, email = s.email,"
                    + " created_at = s.created_at, updated_at = s.updated_at"
                    + " FROM " + mappingTable + " m"
                    + " JOIN " + USER_STAGE_TABLE + " s ON s.source_id = m.source_id"
                    + " WHERE m.entity_type = 'USER' AND m.target_id = u.id");

            updated += targetJdbcTemplate.update(
                "UPDATE " + usersTable + " u"
                    + " SET username = s.username, email = s.email,"
                    + " created_at = s.created_at, updated_at = s.updated_at"
                    + " FROM " + USER_STAGE_TABLE + " s"
                    + " WHERE u.username = s.username"
                    + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                    + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_id)"
                    + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m2"
                    + " WHERE m2.entity_type = 'USER' AND m2.target_id = u.id)");

            long inserted = targetJdbcTemplate.update(
                "INSERT INTO " + usersTable + " (username, email, created_at, updated_at)"
                    + " SELECT s.username, s.email, s.created_at, s.updated_at"
                    + " FROM " + USER_STAGE_TABLE + " s"
                    + " WHERE NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                    + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_id)"
                    + " AND NOT EXISTS (SELECT 1 FROM " + usersTable + " u WHERE u.username = s.username)");

            insertMissingUserMappings(runId);
            requireAllUsersMapped();
            markSeenUserMappings(runId);

            return new ChunkResult(inserted, updated);
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Чанк пользователей конфликтует с ограничениями PostgreSQL "
                    + "(уникальность username/email или внешний ключ)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось применить чанк пользователей в PostgreSQL", exception);
        }
    }`,
          },
        ],
      },
      {
        id: 'initial-load-target-gateway',
        name: 'InitialLoadTargetGateway.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/InitialLoadTargetGateway.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/InitialLoadTargetGateway.java',
        ),
        language: 'java',
        summary:
          'COPY в target с сохранением source id и опциональным populate-mapping.',
        snippets: [
          {
            id: 'initial-load-target-gateway-snip',
            title: 'copyUsers() · copyOrders() · populateMapping() · analyze() · copy()',
            startLine: 118,
            endLine: 220,
            note:
              'COPY FROM STDIN с сохранением id; source id = target id. populateMapping нужен только для последующего mirror. COPY-ошибки ограничений дают 409.',
            code: String.raw`    /**
     * Загружает чанк пользователей через COPY, сохраняя source id.
     */
    public long copyUsers(List<UserRow> rows) {
        StringBuilder csv = new StringBuilder(rows.size() * 160);

        for (UserRow row : rows) {
            csv.append(row.sourceId()).append(',')
                .append(csv(row.username())).append(',')
                .append(csv(row.email())).append(',')
                .append(timestamp(row.createdAt())).append(',')
                .append(timestamp(row.updatedAt())).append('\n');
        }

        return copy(usersTable, "id, username, email, created_at, updated_at", csv);
    }

    /**
     * Загружает чанк заказов через COPY, сохраняя source id и source user id.
     */
    public long copyOrders(List<OrderRow> rows) {
        StringBuilder csv = new StringBuilder(rows.size() * 160);

        for (OrderRow row : rows) {
            csv.append(row.sourceId()).append(',')
                .append(row.sourceUserId()).append(',')
                .append(csv(row.orderNumber())).append(',')
                .append(row.amount().toPlainString()).append(',')
                .append(csv(row.status())).append(',')
                .append(timestamp(row.createdAt())).append('\n');
        }

        return copy(ordersTable, "id, user_id, order_number, amount, status, created_at", csv);
    }

    /**
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
    }

    /**
     * Обновляет статистику планировщика после загрузки.
     */
    public void analyze(String table) {
        try {
            targetJdbcTemplate.execute("ANALYZE " + qualifiedTable(table));
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось выполнить ANALYZE таблицы '" + table + "'", exception);
        }
    }

    private long copy(String table, String columns, CharSequence data) {
        String sql = "COPY " + table + " (" + columns + ") FROM STDIN WITH (FORMAT csv, NULL '')";

        try {
            Long copied = targetJdbcTemplate.execute((ConnectionCallback<Long>) connection -> {
                try {
                    PGConnection pgConnection = connection.unwrap(PGConnection.class);
                    return pgConnection.getCopyAPI().copyIn(sql, new StringReader(data.toString()));
                } catch (IOException exception) {
                    throw new SQLException("Не удалось прочитать CSV для COPY", exception);
                }
            });

            return copied == null ? 0 : copied;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("COPY в таблицу '" + table
                + "' нарушает уникальность, FK или check-constraint", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось выполнить COPY в таблицу '" + table + "'", exception);
        }
    }`,
          },
        ],
      },
      {
        id: 'oracle-row-reader',
        name: 'OracleRowReader.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/source/oracle/OracleRowReader.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/source/oracle/OracleRowReader.java',
        ),
        language: 'java',
        summary:
          'Keyset-чтение Oracle с ROWNUM и range-границами.',
        snippets: [
          {
            id: 'oracle-row-reader-snip',
            title: 'readRows() · readRowsAfter()',
            startLine: 51,
            endLine: 91,
            note:
              'Keyset через WHERE key > ? ORDER BY key и ROWNUM <= ?. Для range-загрузки добавлены maxKey и список колонок; имена ключей проверяются regex.',
            code: String.raw`    @Override
    public List<Map<String, Object>> readRows(String table, int limit) {
        String qualifiedTable = metadataProvider.qualifiedTableName(table);
        int safeLimit = Math.max(limit, 1);

        String sql = "SELECT * FROM " + qualifiedTable + " WHERE ROWNUM <= ?";
        log.debug("Чтение строк таблицы {} с ограничением {}", qualifiedTable, safeLimit);

        return executeQuery(sql, table, safeLimit);
    }

    @Override
    public List<Map<String, Object>> readRowsAfter(String table, String keyColumn, long afterKey, int limit) {
        String qualifiedTable = metadataProvider.qualifiedTableName(table);
        String key = requireSimpleIdentifier(keyColumn);
        int safeLimit = Math.max(limit, 1);

        String sql = "SELECT * FROM (SELECT * FROM " + qualifiedTable + " WHERE " + key + " > ? ORDER BY " + key
            + ") WHERE ROWNUM <= ?";
        log.debug("Чтение страницы таблицы {} после {} с ограничением {}",
            qualifiedTable, afterKey, safeLimit);

        return executeQuery(sql, table, afterKey, safeLimit);
    }

    @Override
    public List<Map<String, Object>> readRowsAfter(String table, String keyColumn, long afterKey, long maxKey,
                                                   int limit, List<String> columns) {
        String qualifiedTable = metadataProvider.qualifiedTableName(table);
        String key = requireSimpleIdentifier(keyColumn);
        int safeLimit = Math.max(limit, 1);
        String select = selectList(columns);

        String sql = "SELECT * FROM (SELECT " + select + " FROM " + qualifiedTable
            + " WHERE " + key + " > ? AND " + key + " <= ? ORDER BY " + key
            + ") WHERE ROWNUM <= ?";
        log.debug("Чтение страницы таблицы {} после {} до {} с ограничением {}",
            qualifiedTable, afterKey, maxKey, safeLimit);

        return executeQuery(sql, table, afterKey, maxKey, safeLimit);
    }`,
          },
        ],
      },
      {
        id: 'generic-initial-load-validation',
        name: 'GenericInitialLoadValidationService.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/GenericInitialLoadValidationService.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/GenericInitialLoadValidationService.java',
        ),
        language: 'java',
        summary:
          'Validation generic-таблиц: counts, агрегаты, nulls и orphan-FK.',
        snippets: [
          {
            id: 'generic-initial-load-validation-snip',
            title: 'validate() · validateTable() · aggregates() · validateForeignKeys()',
            startLine: 59,
            endLine: 188,
            note:
              'Counts, min/max/sum ключа, суммы/длины/null-поля и orphan-FK. Каждая проверка — ValidationCheck; любой false делает отчёт невалидным.',
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
    }

    private List<Aggregate> aggregates(InitialLoadTablePlan plan, boolean source) {
        List<Aggregate> aggregates = new ArrayList<>();
        String keyColumn = source ? plan.sourceKeyColumn() : plan.targetKeyColumn();

        if (plan.keyset()) {
            aggregates.add(new Aggregate("key.min", "MIN(" + quote(keyColumn) + ")"));
            aggregates.add(new Aggregate("key.max", "MAX(" + quote(keyColumn) + ")"));
            aggregates.add(new Aggregate("key.sum", "SUM(" + quote(keyColumn) + ")"));
        }

        for (TableColumnPlan column : plan.columns()) {
            String name = source ? column.sourceColumn() : column.targetColumn();

            if (NUMERIC_TYPES.contains(column.targetJdbcType())) {
                aggregates.add(new Aggregate(column.targetColumn() + ".sum", "SUM(" + quote(name) + ")"));
            } else if (TEXT_TYPES.contains(column.targetJdbcType())) {
                aggregates.add(new Aggregate(column.targetColumn() + ".length",
                    "SUM(LENGTH(" + quote(name) + "))"));
            }

            aggregates.add(new Aggregate(column.targetColumn() + ".nulls",
                "SUM(CASE WHEN " + quote(name) + " IS NULL THEN 1 ELSE 0 END)"));
        }

        return aggregates;
    }

    private TableStats stats(JdbcTemplate jdbcTemplate, String table, List<Aggregate> aggregates,
                             boolean source) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) AS cnt");

        for (int index = 0; index < aggregates.size(); index++) {
            sql.append(", ").append(aggregates.get(index).expression())
                .append(" AS a").append(index);
        }

        sql.append(" FROM ").append(table);

        try {
            return jdbcTemplate.queryForObject(sql.toString(), (resultSet, rowNumber) -> {
                Map<String, BigDecimal> values = new LinkedHashMap<>();

                for (int index = 0; index < aggregates.size(); index++) {
                    values.put(aggregates.get(index).name(), resultSet.getBigDecimal("a" + index));
                }

                return new TableStats(resultSet.getLong("cnt"), values);
            });
        } catch (DataAccessException exception) {
            if (source) {
                throw new SourceAccessException("Не удалось выполнить validation source-таблицы '"
                    + table + "'", exception);
            }

            throw new TargetAccessException("Не удалось выполнить validation target-таблицы '"
                + table + "'", exception);
        }
    }

    private void validateForeignKeys(InitialLoadTablePlan plan, List<ValidationCheck> checks) {
        for (ForeignKeyMetadata foreignKey : targetGateway.foreignKeys(plan.targetTable())) {
            String child = qualifiedTable(plan.targetTable());
            String parent = qualifiedTable(foreignKey.referencedTable());
            StringBuilder join = new StringBuilder();

            for (int index = 0; index < foreignKey.columns().size(); index++) {
                if (index > 0) {
                    join.append(" AND ");
                }

                join.append("c.").append(quote(foreignKey.columns().get(index)))
                    .append(" = p.").append(quote(foreignKey.referencedColumns().get(index)));
            }

            String notNullColumn = quote(foreignKey.columns().getFirst());
            String sql = "SELECT COUNT(*) FROM " + child + " c"
                + " LEFT JOIN " + parent + " p ON " + join
                + " WHERE p." + quote(foreignKey.referencedColumns().getFirst()) + " IS NULL"
                + " AND c." + notNullColumn + " IS NOT NULL";

            Long orphans = targetJdbcTemplate.queryForObject(sql, Long.class);
            long count = orphans == null ? 0 : orphans;
            checks.add(check(plan.targetTable() + "." + foreignKey.name() + ".orphans",
                0, count, count == 0));
        }
    }`,
          },
        ],
      },
      {
        id: 'parallel-table-load-service',
        name: 'ParallelTableLoadService.java',
        path:
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/ParallelTableLoadService.java',
        githubUrl: githubBlobUrl(
          'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/ParallelTableLoadService.java',
        ),
        language: 'java',
        summary:
          'Параллельные range-загрузки с per-range checkpoint MAX(id).',
        snippets: [
          {
            id: 'parallel-table-load-service-snip',
            title: 'load() · loadRange() · readAndWrite() · ranges()',
            startLine: 38,
            endLine: 200,
            note:
              'MIN/MAX делятся на непересекающиеся диапазоны, каждый worker коммитит свои COPY-чанки. Resume диапазона — MAX(key) внутри диапазона.',
            code: String.raw`    /**
     * Загружает таблицу и возвращает число прочитанных строк.
     */
    public long load(TableRangeLoadSpec spec, MigrationRunContext context) {
        long sourceMin = rowReader.minKey(spec.sourceTable(), spec.sourceKeyColumn());
        long sourceMax = rowReader.maxKey(spec.sourceTable(), spec.sourceKeyColumn());

        if (sourceMin == Long.MIN_VALUE && sourceMax == Long.MIN_VALUE) {
            log.info("Parallel initial-load {}: таблица пуста", spec.targetTable());
            return 0;
        }

        int workers = Math.max(properties.getWorkers(), 1);
        List<Range> ranges = ranges(sourceMin, sourceMax, workers);
        ExecutorService executor = Executors.newFixedThreadPool(ranges.size(), threadFactory(spec.targetTable()));
        AtomicLong totalRows = new AtomicLong();
        AtomicLong lastId = new AtomicLong(Long.MIN_VALUE);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        AtomicBoolean stopping = new AtomicBoolean();
        List<Future<?>> futures = new ArrayList<>();

        log.info("Parallel initial-load {}: workers={}, ranges={}, source={}..{}",
            spec.targetTable(), ranges.size(), ranges.size(), sourceMin, sourceMax);

        for (Range range : ranges) {
            futures.add(executor.submit(() -> {
                loadRange(spec, range, context, totalRows, lastId, sourceMax, failure, stopping);
                return null;
            }));
        }

        try {
            for (Future<?> future : futures) {
                future.get();
            }
        } catch (ExecutionException exception) {
            failure.compareAndSet(null, exception.getCause());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            failure.compareAndSet(null, new MigrationException(
                "Параллельная initial-load прервана", exception));
        } finally {
            stopping.set(true);

            if (failure.get() != null) {
                futures.forEach(future -> future.cancel(true));
            }

            executor.shutdownNow();
        }

        Throwable throwable = failure.get();

        if (throwable instanceof RuntimeException runtimeException) {
            throw runtimeException;
        }

        if (throwable instanceof Error error) {
            throw error;
        }

        if (throwable != null) {
            throw new MigrationException("Ошибка параллельной initial-load", throwable);
        }

        log.info("Parallel initial-load {} завершён: {} строк", spec.targetTable(), totalRows.get());
        return totalRows.get();
    }

    private void loadRange(TableRangeLoadSpec spec,
                           Range range,
                           MigrationRunContext context,
                           AtomicLong totalRows,
                           AtomicLong lastId,
                           long sourceMax,
                           AtomicReference<Throwable> failure,
                           AtomicBoolean stopping) {
        long after = properties.isResume()
            ? spec.resume().maxKeyBetween(spec.targetTable(), spec.targetKeyColumn(), range.from(), range.to())
            : before(range.from());

        if (after == Long.MIN_VALUE) {
            after = before(range.from());
        }

        try {
            while (!stopping.get() && failure.get() == null) {
                context.checkCancelled();

                long pageAfter = after;
                List<Map<String, Object>> page = retryExecutor.execute(
                    "parallel initial-load " + spec.targetTable(),
                    () -> readAndWrite(spec, pageAfter, range.to()));

                if (page.isEmpty()) {
                    return;
                }

                Long nextValue = RowValues.asLong(page.getLast(), spec.sourceKeyColumn());

                if (nextValue == null) {
                    throw new MigrationException("В строке отсутствует ключевая колонка "
                        + spec.sourceKeyColumn());
                }

                long next = nextValue;

                after = next;
                long loaded = totalRows.addAndGet(page.size());
                lastId.accumulateAndGet(next, Math::max);
                context.progress(spec.targetTable(), lastId.get(), loaded, sourceMax);
            }
        } catch (Throwable throwable) {
            failure.compareAndSet(null, throwable);
            stopping.set(true);
        }
    }

    private List<Map<String, Object>> readAndWrite(TableRangeLoadSpec spec, long after, long to) {
        List<Map<String, Object>> page = rowReader.readRowsAfter(
            spec.sourceTable(), spec.sourceKeyColumn(), after, to,
            spec.chunkSize(), spec.sourceColumns());

        if (page.isEmpty()) {
            return page;
        }

        targetTransactionTemplate.executeWithoutResult(status -> {
            long copied = spec.writer().write(page);

            if (copied != page.size()) {
                throw new MigrationException("COPY " + spec.targetTable() + " загрузил "
                    + copied + " строк вместо " + page.size());
            }
        });

        return page;
    }

    private List<Range> ranges(long sourceMin, long sourceMax, int workers) {
        if (sourceMin == sourceMax || workers <= 1) {
            return List.of(new Range(sourceMin, sourceMax));
        }

        long span = sourceMax - sourceMin;
        long count = Math.min(workers, Math.max(span + 1, 1));
        long step = Math.max(span / count + 1, 1);
        List<Range> ranges = new ArrayList<>();
        long from = sourceMin;

        for (int index = 0; index < count && from <= sourceMax; index++) {
            long to = index == count - 1 ? sourceMax : Math.min(from + step - 1, sourceMax);

            if (to < from) {
                to = sourceMax;
            }

            ranges.add(new Range(from, to));
            from = to + 1;
        }

        return ranges;
    }`,
          },
        ],
      },
    ],
  },
  {
    id: 'schema-migration',
    label: 'module-schema-migration',
    port: '8084',
    summary:
      'Schema migration: Oracle metadata → PostgreSQL DDL и type fidelity.',
    files: [
      {
        id: 'postgres-type-mapper',
        name: 'PostgresTypeMapper.java',
        path:
          'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/generator/PostgresTypeMapper.java',
        githubUrl: githubBlobUrl(
          'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/generator/PostgresTypeMapper.java',
        ),
        language: 'java',
        summary:
          'Преобразование Oracle-типов, defaults и fidelity warnings.',
        snippets: [
          {
            id: 'postgres-type-mapper-snip',
            title: 'map() · defaultClause() · mapNumber()',
            startLine: 16,
            endLine: 148,
            note:
              'NUMBER(1)→BOOLEAN, precision→INTEGER/BIGINT/NUMERIC, BYTE/timestamp/LONG/INTERVAL warnings. Identity только для integer-типов.',
            code: String.raw`    public MappedType map(OracleColumn column) {
        String typeName = upper(column.typeName());
        String pgType;
        String warning = null;

        if (typeName.startsWith("NUMBER")) {
            pgType = mapNumber(column);
        } else if (typeName.startsWith("VARCHAR2") || typeName.startsWith("NVARCHAR2")) {
            pgType = column.size() > 0 ? "VARCHAR(" + column.size() + ")" : "TEXT";
        } else if (typeName.startsWith("CHAR") || typeName.startsWith("NCHAR")) {
            pgType = "CHAR(" + Math.max(column.size(), 1) + ")";
        } else if (typeName.contains("JSON")) {
            pgType = "JSONB";
        } else if (typeName.contains("CLOB")) {
            pgType = "TEXT";
        } else if (typeName.contains("BLOB") || typeName.startsWith("RAW") || typeName.contains("LONG RAW")) {
            pgType = "BYTEA";
        } else if (typeName.startsWith("LONG")) {
            pgType = "TEXT";
            warning = "Oracle LONG для колонки " + column.name() + " преобразован в TEXT";
        } else if (typeName.startsWith("DATE")) {
            pgType = "TIMESTAMP";
        } else if (typeName.startsWith("TIMESTAMP")) {
            pgType = typeName.contains("WITH TIME ZONE") && !typeName.contains("LOCAL")
                ? "TIMESTAMPTZ"
                : "TIMESTAMP";
        } else if (typeName.startsWith("BINARY_DOUBLE") || typeName.startsWith("DOUBLE")) {
            pgType = "DOUBLE PRECISION";
        } else if (typeName.startsWith("BINARY_FLOAT")) {
            pgType = "REAL";
        } else if (typeName.startsWith("FLOAT")) {
            pgType = "DOUBLE PRECISION";
        } else if (typeName.startsWith("BOOLEAN")) {
            pgType = "BOOLEAN";
        } else {
            pgType = "TEXT";
            warning = "Неизвестный Oracle-тип " + column.typeName() + " для колонки " + column.name()
                + "; использован TEXT";
        }

        warning = appendWarning(warning, semanticWarning(typeName, column));

        boolean identity = column.identity();

        if (identity && !isIntegerType(pgType)) {
            identity = false;
            warning = "Identity-колонка " + column.name() + " имеет нецелевой тип " + pgType
                + "; identity не создаётся";
        }

        if (identity) {
            pgType = pgType + " GENERATED BY DEFAULT AS IDENTITY";
        }

        return new MappedType(pgType, identity, warning);
    }

    public String defaultClause(OracleColumn column, MappedType mapped, List<String> warnings) {
        if (column.identity()) {
            return null;
        }

        String value = column.defaultValue();

        if (value == null || value.isBlank() || "NULL".equalsIgnoreCase(value.trim())) {
            return null;
        }

        value = value.trim();
        String normalized = value.toUpperCase(Locale.ROOT);

        if (normalized.contains("NEXTVAL") || normalized.contains("CURRVAL")
            || normalized.contains("NEXT VALUE FOR")) {
            warnings.add("Default sequence.nextval для " + column.name() + " не перенесён автоматически");
            return null;
        }

        if (normalized.contains("TO_DATE") || normalized.contains("TO_TIMESTAMP")
            || normalized.contains("TO_CHAR") || normalized.contains("TO_NUMBER")
            || normalized.contains("SYS_GUID") || normalized.contains("SYS_CONTEXT")
            || normalized.contains("DBMS_RANDOM") || normalized.contains("DECODE")
            || normalized.contains("NVL") || normalized.contains("UID")
            || normalized.equals("USER")) {
            warnings.add("Default " + value + " для " + column.name() + " требует ручного преобразования");
            return null;
        }

        if (mapped.targetType().toUpperCase(Locale.ROOT).startsWith("BOOLEAN")) {
            String booleanValue = value.replace("'", "").replace("\"", "").trim();

            if ("0".equals(booleanValue) || "false".equalsIgnoreCase(booleanValue)) {
                return "FALSE";
            }

            if ("1".equals(booleanValue) || "true".equalsIgnoreCase(booleanValue)) {
                return "TRUE";
            }
        }

        if (normalized.contains("LOCALTIMESTAMP") || normalized.contains("SYSDATE")
            || normalized.contains("SYSTIMESTAMP") || normalized.contains("CURRENT_TIMESTAMP")) {
            return "CURRENT_TIMESTAMP";
        }

        return value;
    }

    private String mapNumber(OracleColumn column) {
        int precision = column.size();
        int scale = column.decimalDigits();

        if (precision <= 0) {
            return "NUMERIC";
        }

        if (scale > 0) {
            return "NUMERIC(" + precision + "," + scale + ")";
        }

        if (precision <= 1) {
            return "BOOLEAN";
        }

        if (precision <= 9) {
            return "INTEGER";
        }

        if (precision <= 19) {
            return "BIGINT";
        }

        return "NUMERIC(" + precision + ",0)";
    }`,
          },
        ],
      },
      {
        id: 'postgres-ddl-generator',
        name: 'PostgresDdlGenerator.java',
        path:
          'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/generator/PostgresDdlGenerator.java',
        githubUrl: githubBlobUrl(
          'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/generator/PostgresDdlGenerator.java',
        ),
        language: 'java',
        summary:
          'Генерация SchemaMigrationPlan и PostgreSQL DDL.',
        snippets: [
          {
            id: 'postgres-ddl-generator-snip',
            title: 'generate()',
            startLine: 41,
            endLine: 114,
            note:
              'Фазы SCHEMA/SEQUENCE/TABLE/FK/INDEX/COMMENT, drift только через nullable-колонки. Warnings и unsupportedObjects попадают в SchemaMigrationPlan.',
            code: String.raw`    public SchemaMigrationPlan generate(OracleSchema source, PostgresTargetSnapshot target) {
        String targetSchema = target.schema();
        List<SchemaDdlStatement> statements = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Set<String> usedNames = new HashSet<>();
        Set<String> existingTables = target.tables();
        Set<String> newTables = new LinkedHashSet<>();

        add(statements, "SCHEMA", "SCHEMA", targetSchema,
            "CREATE SCHEMA IF NOT EXISTS " + quote(targetSchema));

        for (OracleSequence sequence : source.sequences()) {
            add(statements, "SEQUENCE", "SEQUENCE", sequence.name(),
                "CREATE SEQUENCE IF NOT EXISTS " + quote(targetSchema) + "." + quote(name(sequence.name()))
                    + " START WITH " + Math.max(sequence.startWith(), 1)
                    + " INCREMENT BY " + sequence.incrementBy());
        }

        addMappingTable(statements, targetSchema);

        for (OracleTable table : source.tables()) {
            String targetTable = table.name().toLowerCase(Locale.ROOT);

            if (!existingTables.contains(targetTable)) {
                newTables.add(targetTable);
                add(statements, "TABLE", "TABLE", table.name(), createTable(targetSchema, table, usedNames, warnings));
            } else {
                addMissingColumns(statements, targetSchema, table, target.columns().getOrDefault(targetTable, Set.of()),
                    warnings);
            }
        }

        for (OracleTable table : source.tables()) {
            String targetTable = table.name().toLowerCase(Locale.ROOT);

            if (!newTables.contains(targetTable)) {
                continue;
            }

            for (OracleForeignKey key : table.foreignKeys()) {
                add(statements, "FOREIGN_KEY", "FOREIGN_KEY", key.name(),
                    foreignKey(targetSchema, table, key, usedNames));
            }

            for (OracleIndex index : table.indexes()) {
                if (!index.unique()) {
                    add(statements, "INDEX", "INDEX", index.name(),
                        index(targetSchema, table, index, usedNames));
                }
            }
        }

        for (OracleTable table : source.tables()) {
            addComments(statements, targetSchema, table);
        }

        for (var unsupported : source.unsupportedObjects()) {
            warnings.add("Не переносится автоматически: " + unsupported.type() + " (" + unsupported.count() + ")");
        }

        log.info("Сгенерирован DDL: source={}, target={}, tables={}, statements={}, newTables={}",
            source.schema(), targetSchema, source.tables().size(), statements.size(), newTables.size());

        return SchemaMigrationPlan.builder()
            .sourceSchema(source.schema())
            .targetSchema(targetSchema)
            .targetEmpty(existingTables.isEmpty())
            .tables(source.tables().size())
            .statements(statements.size())
            .ddl(statements)
            .warnings(warnings)
            .unsupportedObjects(source.unsupportedObjects())
            .build();
    }`,
          },
        ],
      },
    ],
  },
];
