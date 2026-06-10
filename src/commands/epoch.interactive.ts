import { colorQuestions } from '../utility';

/**
 * TTY-only fallback for `mfn epoch` when no flags/positional are supplied.
 * Lives in its own module to keep epoch.ts focused on the headless paths
 * (and under the 150-line file budget).
 */
export async function epochInteractive(
  argv: any,
  epochToDate: (argv: any, value: number) => void,
  dateToEpoch: (argv: any, input: string, format?: string, tz?: string) => void,
): Promise<void> {
  // inquirer is TTY-only — lazy import keeps headless invocations fast.
  const { default: inquirer } = await import('inquirer');
  const { operation } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'operation',
      message: colorQuestions('What do you want to do?'),
      choices: [
        { name: 'Convert epoch → human-readable date', value: 'epochToDate' },
        { name: 'Convert date string → epoch', value: 'dateToEpoch' },
      ],
    },
  ]);
  if (operation === 'epochToDate') {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: colorQuestions('Enter epoch value:'),
        validate: (v: string) => (v.trim() && !isNaN(Number(v))) || 'Enter a number',
      },
    ]);
    epochToDate(argv, Number(value));
  } else {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: colorQuestions('Enter a date string (ISO 8601):'),
        validate: (v: string) => Boolean(v.trim()) || 'Enter a date string',
      },
    ]);
    dateToEpoch(argv, input, undefined, argv.tz);
  }
}
