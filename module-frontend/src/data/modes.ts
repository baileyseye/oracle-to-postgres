import type {
  ModeCard,
  ModeComparisonRow,
  StrategyCard,
} from '../types/modes';

export const MODE_CARDS: readonly ModeCard[] = [
  {
    id: 'initial-load',
    title: 'initial-load',
    badge: 'по умолчанию',
    summary:
      'Остановка писателей Oracle, COPY в пустой target с сохранением source id, ' +
      'отдельный commit на чанк и validation gate перед cutover.',
    facts: [
      'sourceGuard: idle source + SCN',
      'COPY: users → orders → generic',
      'source id сохраняется',
      'resume продолжает с MAX(id)',
    ],
  },
  {
    id: 'mirror',
    title: 'mirror',
    badge: 'без простоя',
    summary:
      'Keyset-страницы по source id, TEMP staging и set-based upsert/adoption/stale ' +
      'через migration_entity_map. Вся запись target — в одной транзакции.',
    facts: [
      'advisory lock на запуск',
      'runId = txid_current()',
      'source_id → target_id в map',
      'stale удаляется по last_seen_run',
    ],
  },
];

export const MODE_COMPARISON: readonly ModeComparisonRow[] = [
  {
    criterion: 'Простой',
    initialLoad: 'Нужна остановка писателей Oracle',
    mirror: 'Без остановки окружения',
  },
  {
    criterion: 'Консистентность',
    initialLoad: 'Idle source + SCN; target пуст. FAILED блокирует cutover',
    mirror: 'Одна target-транзакция; stale по last_seen_run',
  },
  {
    criterion: 'Память',
    initialLoad: 'COPY-чанки; LOB-чанк 10; heap не зависит от объёма',
    mirror: 'Keyset-страницы 5000; TEMP staging; карты в SQL',
  },
  {
    criterion: 'Продолжение',
    initialLoad: 'resume=true продолжает с MAX(id)',
    mirror: 'Повторный run идемпотентен; resume не нужен',
  },
  {
    criterion: 'Стратегия id',
    initialLoad: 'Source id сохраняются; optional populate-mapping',
    mirror: 'source_id → target_id в migration_entity_map',
  },
  {
    criterion: 'Транзакции',
    initialLoad: 'Commit на каждый COPY-чанк',
    mirror: 'Одна target-транзакция на запуск',
  },
  {
    criterion: 'Параллельность',
    initialLoad: 'workers=4; непересекающиеся range с MAX(key)',
    mirror: 'Нет: одна транзакция',
  },
];

export const STRATEGY_CARDS: readonly StrategyCard[] = [
  {
    id: 'stop',
    title: 'Полная остановка',
    status: 'implemented',
    statusLabel: 'initial-load · реализовано',
    summary:
      'Остановить писателей, перенести схему и данные, дождаться validation, ' +
      'затем открыть приложение на PostgreSQL.',
    metrics: [
      { label: 'Простой', value: 'полное окно' },
      { label: 'Сложность', value: 'низкая' },
      { label: 'Консистентность', value: 'SCN + validation' },
      { label: 'Откат', value: 'truncate / resume' },
    ],
    note:
      'Дефолт проекта. Самый короткий путь к контролируемому cutover: нет upsert, ' +
      'adoption и stale-логики.',
  },
  {
    id: 'hybrid',
    title: 'Гибрид',
    status: 'supported',
    statusLabel: 'initial-load + mirror · есть блоки',
    summary:
      'Быстрый COPY в короткое окно, populate-mapping, затем mirror для догона ' +
      'и финального cutover.',
    metrics: [
      { label: 'Простой', value: 'короткое окно' },
      { label: 'Сложность', value: 'высокая' },
      { label: 'Консистентность', value: 'mapping + stale' },
      { label: 'Откат', value: 'target-транзакция' },
    ],
    note:
      'В репозитории есть populate-mapping и mirror, но автоматического ' +
      'оркестратора гибрида нет — переход между режимами настраивается вручную.',
  },
  {
    id: 'cdc',
    title: 'CDC real-time',
    status: 'external',
    statusLabel: 'вне scope проекта',
    summary:
      'Log-based capture изменений Oracle и непрерывный поток в PostgreSQL. ' +
      'Требует Debezium/LogMiner и отдельной инфраструктуры.',
    metrics: [
      { label: 'Простой', value: '≈0' },
      { label: 'Сложность', value: 'очень высокая' },
      { label: 'Консистентность', value: 'ordering + replay' },
      { label: 'Откат', value: 'сложный' },
    ],
    note:
      'CDC в проекте не реализован. Карточка показывает альтернативу и не ' +
      'обещает функциональность, которой нет в коде.',
  },
];
