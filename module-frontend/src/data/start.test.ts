import { describe, expect, it } from 'vitest';
import { getStartScenario, START_SHELL_OPTIONS } from './start';

describe('start scenarios', () => {
  it('exposes bash and PowerShell command variants', () => {
    expect(START_SHELL_OPTIONS.map((option) => option.id)).toEqual([
      'bash',
      'powershell',
    ]);
  });

  it('keeps six real steps for both schema owners and shells', () => {
    for (const owner of ['public', 'auto_migration'] as const) {
      for (const shell of ['bash', 'powershell'] as const) {
        const scenario = getStartScenario(owner, shell);

        expect(scenario.steps).toHaveLength(6);
        expect(scenario.steps.every((step) => step.commands.length > 0)).toBe(
          true,
        );
        expect(scenario.checklist.length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('uses the selected schema and shell in the migration command', () => {
    const bash = getStartScenario('auto_migration', 'bash');
    const powershell = getStartScenario('public', 'powershell');
    const bashData = bash.steps.find((step) => step.id === 'data');
    const powershellData = powershell.steps.find(
      (step) => step.id === 'data',
    );
    const bashCommand = bashData?.commands[0]?.value ?? '';
    const powershellCommand = powershellData?.commands[0]?.value ?? '';

    expect(bashCommand).toContain('TARGET_POSTGRES_SCHEMA=auto_migration');
    expect(bashCommand).toContain('./gradlew :module-migration:bootRun');
    expect(powershellCommand).toContain(
      '$env:TARGET_POSTGRES_SCHEMA="public"',
    );
    expect(powershellCommand).toContain(
      '.\\gradlew.bat :module-migration:bootRun',
    );

    const powershellCurls = powershell.steps.flatMap((step) =>
      step.commands
        .map((command) => command.value)
        .filter((value) => value.includes('curl')),
    );
    const bashCurls = bash.steps.flatMap((step) =>
      step.commands
        .map((command) => command.value)
        .filter((value) => value.includes('curl')),
    );

    expect(powershellCurls.every((value) => value.includes('curl.exe'))).toBe(
      true,
    );
    expect(bashCurls.some((value) => value.includes('curl.exe'))).toBe(false);
  });

  it('adds the schema apply only for auto_migration', () => {
    const publicScenario = getStartScenario('public', 'bash');
    const autoScenario = getStartScenario('auto_migration', 'bash');
    const publicSchema = publicScenario.steps.find(
      (step) => step.id === 'schema',
    );
    const autoSchema = autoScenario.steps.find(
      (step) => step.id === 'schema',
    );
    const autoCommands = autoSchema?.commands.map(
      (command) => command.value,
    );

    expect(publicSchema?.title).toContain('public');
    expect(autoSchema?.title).toContain('auto_migration');
    expect(autoCommands?.some((value) => value.includes('/apply'))).toBe(
      true,
    );
    expect(
      publicSchema?.commands.some((command) =>
        command.value.includes('/apply'),
      ),
    ).toBe(false);
  });

  it('does not ship placeholders in executable commands', () => {
    for (const owner of ['public', 'auto_migration'] as const) {
      for (const shell of ['bash', 'powershell'] as const) {
        const scenario = getStartScenario(owner, shell);
        const commands = scenario.steps.flatMap((step) =>
          step.commands.map((command) => command.value),
        );

        for (const command of commands) {
          expect(command).not.toMatch(/TODO|FIXME|YOUR_|<placeholder>/i);
        }
      }
    }
  });
});
