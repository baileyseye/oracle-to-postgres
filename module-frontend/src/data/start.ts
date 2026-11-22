import type { SchemaOwnerId } from '../types/architecture';
import type {
  StartScenario,
  StartShell,
  StartShellOption,
  StartStep,
} from '../types/start';

export const START_SHELL_OPTIONS: readonly StartShellOption[] = [
  { id: 'bash', label: 'bash', hint: 'macOS / Linux' },
  { id: 'powershell', label: 'PowerShell', hint: 'Windows' },
];

const CHECKLIST: readonly string[] = [
  'Писатели Oracle остановлены на время initial-load.',
  'В source-схеме нет активных пользовательских сессий.',
  'У target-схемы один владелец: Liquibase или schema-мигратор.',
  'TARGET_POSTGRES_SCHEMA совпадает с выбранным сценарием.',
  'Target-приложение не открывается пользователям до validation=true.',
  'Пароли и URL заданы через env, а не в git.',
];

function gradle(shell: StartShell): string {
  return shell === 'bash' ? './gradlew' : '.\\gradlew.bat';
}

function curlCommand(shell: StartShell): string {
  return shell === 'bash' ? 'curl' : 'curl.exe';
}

function migrationBootCommand(
  owner: SchemaOwnerId,
  shell: StartShell,
): string {
  if (shell === 'bash') {
    return [
      'MIGRATION_MODE=initial-load \\',
      `TARGET_POSTGRES_SCHEMA=${owner} \\`,
      `${gradle(shell)} :module-migration:bootRun`,
    ].join('\n');
  }

  return [
    '$env:MIGRATION_MODE="initial-load"',
    `$env:TARGET_POSTGRES_SCHEMA="${owner}"`,
    `${gradle(shell)} :module-migration:bootRun`,
  ].join('\n');
}

function schemaStep(owner: SchemaOwnerId, shell: StartShell): StartStep {
  if (owner === 'public') {
    return {
      id: 'schema',
      title: 'Создать схему public',
      description:
        'Liquibase модуля module-postgres создаёт users, orders, insurance_program_users и migration_entity_map.',
      commands: [
        {
          label: 'терминал 1',
          value: `${gradle(shell)} :module-oracle:bootRun`,
        },
        {
          label: 'терминал 2',
          value: `${gradle(shell)} :module-postgres:bootRun`,
        },
      ],
      note: 'Дождитесь UP на 8081 и 8082. Schema-мигратор в этом сценарии не запускается.',
    };
  }

  return {
    id: 'schema',
    title: 'Создать схему auto_migration',
    description:
      'module-schema-migration читает Oracle, генерирует PostgreSQL DDL и применяет его одной транзакцией.',
    commands: [
      {
        label: 'терминал 1',
        value: `${gradle(shell)} :module-oracle:bootRun`,
      },
      {
        label: 'терминал 2',
        value: `${gradle(shell)} :module-schema-migration:bootRun`,
      },
      {
        label: 'терминал 3 · после старта 8084',
        value:
          `${curlCommand(shell)} -X POST "http://localhost:8084/api/v1/schema-migration/apply"`,
      },
    ],
    note: 'auto_migration принадлежит module-schema-migration; module-postgres в этом сценарии не участвует.',
  };
}

function createSteps(owner: SchemaOwnerId, shell: StartShell): StartStep[] {
  const command = gradle(shell);
  const steps: StartStep[] = [
    {
      id: 'infra',
      title: 'Поднять СУБД',
      description:
        'Oracle Free 23 и PostgreSQL 17 поднимаются из docker-compose с healthcheck и проброшенными портами.',
      commands: [{ label: 'корень репозитория', value: 'docker compose up -d' }],
      note: 'Oracle слушает 1521, PostgreSQL — 5432. Креды демо-стенда заданы в docker-compose.yaml.',
    },
    {
      id: 'build',
      title: 'Собрать модули',
      description:
        'Gradle 9.8.2 и Java 25 toolchain собирают четыре Spring Boot приложения и генерируют MapStruct-мапперы.',
      commands: [
        { label: 'проверка JDK', value: 'java -version' },
        { label: shell, value: `${command} clean build` },
      ],
      note: 'Для сборки нужен JDK 25: Gradle 9.8.2 не запустится на Java 8, а toolchain проекта требует 25. Если java -version показывает 8, задайте JAVA_HOME или Gradle JVM в IDEA до сборки.',
    },
    schemaStep(owner, shell),
    {
      id: 'data',
      title: 'Загрузить данные',
      description:
        'module-migration запускается с выбранной target-схемой, затем initial-load выполняется как async job с progress и отменой.',
      commands: [
        {
          label: `терминал 4 · ${shell}`,
          value: migrationBootCommand(owner, shell),
        },
        {
          label: 'терминал 5 · после старта 8083',
          value: `${curlCommand(shell)} -X POST "http://localhost:8083/api/v1/migration/run/async"`,
        },
      ],
      note: 'В демо-конфиге truncate-target=true: initial-load сам очищает users, orders и migration_entity_map в target-схеме. Для production или resume задайте MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET=false.',
      noteTone: 'warning',
    },
    {
      id: 'frontend',
      title: 'Открыть витрину',
      description:
        'Standalone React-приложение показывает схему, код, типы и LIVE-панель поверх запущенных модулей.',
      commands: [
        {
          label: 'терминал 6',
          value: 'cd module-frontend\nnpm ci\nnpm run dev',
        },
      ],
      note: 'Откройте http://localhost:5173 и переключите режим в LIVE. Индикатор должен показать 4/4.',
    },
    {
      id: 'verify',
      title: 'Проверить результат',
      description:
        'Сравните counts, schema diff и статус schema migration. Для initial-load успешный validation обязателен.',
      commands: [
        {
          label: `${curlCommand(shell)} · counts`,
          value: `${curlCommand(shell)} "http://localhost:8083/api/v1/migration/status"`,
        },
        {
          label: `${curlCommand(shell)} · schema diff`,
          value: `${curlCommand(shell)} "http://localhost:8083/api/v1/migration/schema/diff"`,
        },
        ...(owner === 'auto_migration'
          ? [
              {
                label: `${curlCommand(shell)} · schema status`,
                value: `${curlCommand(shell)} "http://localhost:8084/api/v1/schema-migration/status"`,
              },
            ]
          : []),
      ],
      note: 'Если validation вернула false или job получил FAILED, приложение на target-схеме не открывается.',
    },
  ];

  return steps;
}

export function getStartScenario(
  owner: SchemaOwnerId,
  shell: StartShell,
): StartScenario {
  return {
    owner,
    steps: createSteps(owner, shell),
    checklist: CHECKLIST,
  };
}
