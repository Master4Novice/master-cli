import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { logoWelcome } from '../logo/draw';
import { createHiddenCacheDirectory } from '../utility';

createHiddenCacheDirectory();
await logoWelcome();
const instance = yargs(hideBin(process.argv));
const mfn = chalk.hex('#44bcd8').bold('mfn');

export default instance.scriptName(mfn);
