import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import {
  Logger,
  getCacheDirectory,
  validateNumberArguments,
  saveIgnoresToCache,
} from '../utility';
import { withJsonFlag, emit, fail } from '../utility/io';

const logger = Logger();
const CTS_IGNORE_CACHE = path.join(getCacheDirectory(), 'cts_ignore.json');
const DEFAULT_IGNORES = ['node_modules', '.git', '.nx'];

interface CTSIgnore {
  ignores: string[];
}

async function getIgnoresFromCache(): Promise<CTSIgnore> {
  try {
    return await fs.readJson(CTS_IGNORE_CACHE);
  } catch (error: any) {
    if (error.code === 'ENOENT') return { ignores: [] };
    throw error;
  }
}

/** Build an ASCII tree string for `dirPath` (no shared mutable state). */
function buildTreeText(dirPath: string, ignore: Set<string>, prefix = ''): string {
  let out = '';
  let items: string[];
  try {
    items = fs
      .readdirSync(dirPath)
      .filter((item) => !ignore.has(item))
      .sort();
  } catch {
    // Unreadable directory (permissions etc.) — mark it and move on.
    return `${prefix}└── [unreadable]\n`;
  }
  items.forEach((item, index) => {
    const itemPath = path.join(dirPath, item);
    const isLast = index === items.length - 1;
    // A broken symlink / vanished entry must NOT crash the whole tree — treat
    // anything we can't stat as a leaf. (BUG-1: this used to throw uncaught,
    // producing a stack trace and no JSON.)
    let isDir = false;
    try {
      isDir = fs.statSync(itemPath).isDirectory();
    } catch {
      isDir = false;
    }
    out += `${prefix}${isLast ? '└── ' : '├── '}${item}\n`;
    if (isDir) {
      out += buildTreeText(itemPath, ignore, `${prefix}${isLast ? '    ' : '│   '}`);
    }
  });
  return out;
}

/** Render the tree text into an SVG document. */
function treeToSvg(tree: string, height: number, width: number): string {
  const lines = tree.split('\n');
  const body = lines
    .map(
      (line, i) =>
        `<text style="white-space: pre;" x="0" y="${20 + i * 20}">${line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</text>`,
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="white"/>` +
    `<g fill="black" font-family="monospace" font-size="12">${body}</g></svg>`
  );
}

const command = 'cts';
const describe = 'Print (or export) a tree of the current working directory';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('type', {
      alias: 't',
      describe: 'Output format: text (stdout, default) or an image file',
      type: 'string',
      choices: ['text', 'svg', 'png', 'jpeg'],
      default: 'text',
    })
    .option('ignore', { alias: 'i', describe: 'Folder names to ignore', type: 'array' })
    .option('length', { alias: 'l', describe: 'Image height', type: 'number', default: 250 })
    .option('breadth', { alias: 'b', describe: 'Image width', type: 'number', default: 200 })
    .example('mfn cts', 'print the tree as text')
    .example('mfn cts --json', 'tree as JSON')
    .example('mfn cts -t png', 'export the tree to <dir>.png');

const handler = async (argv: any) => {
  let ignores = (argv.ignore as string[]) ?? [];
  if (ignores.length > 0) {
    await saveIgnoresToCache({ ignores }, CTS_IGNORE_CACHE).catch(() => {});
  } else {
    ignores = (await getIgnoresFromCache()).ignores ?? [];
  }
  const ignoreSet = new Set([...DEFAULT_IGNORES, ...ignores]);

  const rootDir = process.cwd();
  const rootName = path.basename(rootDir);

  let tree: string;
  try {
    tree = rootName + '\n' + buildTreeText(rootDir, ignoreSet);
  } catch (error) {
    // Backstop — buildTreeText is defensive per-entry, but never let an
    // unexpected throw escape as a bare stack trace (contract: always JSON).
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'TreeError', `Failed to build tree for ${rootDir}: ${message}`);
  }

  const type = String(argv.type);
  if (type === 'text') {
    return emit(argv, { root: rootName, path: rootDir, format: 'text', tree }, () => {
      process.stdout.write(tree.endsWith('\n') ? tree : tree + '\n');
    });
  }

  // Image output: validate dimensions.
  if (!validateNumberArguments(argv.length, argv.breadth)) {
    return fail(argv, 'InvalidDimensions', 'Length & breadth must be numbers in 1..1000.', 2);
  }
  const file = `${rootName}.${type}`;
  try {
    const svg = treeToSvg(tree, argv.length, argv.breadth);
    if (type === 'svg') {
      fs.outputFileSync(file, svg);
    } else {
      await sharp(Buffer.from(svg))[type === 'png' ? 'png' : 'jpeg']().toFile(file);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ExportFailed', `Failed to write ${file}: ${message}`);
  }
  emit(argv, { root: rootName, path: rootDir, format: type, file }, () =>
    logger.info(`Tree for ${rootName} written to ${file}`),
  );
};

const cts = { command, describe, builder, handler };

export default cts;
