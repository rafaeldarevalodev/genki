import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const serverBoundaryRoots = ['src/app/api', 'src/ai/flows'];
const serverAction = 'src/app/actions.ts';

function collectTypeScriptFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);

    if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
    return /(?<!\.test)\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function serverBoundarySources() {
  const root = process.cwd();
  const files = [
    join(root, serverAction),
    ...serverBoundaryRoots.flatMap((path) => collectTypeScriptFiles(join(root, path))),
  ];

  return files.map((file) => ({
    path: relative(root, file),
    source: readFileSync(file, 'utf8'),
  }));
}

describe('model connection server boundary', () => {
  it('keeps all model connection modules out of server actions, routes, and AI flows', () => {
    const sources = serverBoundarySources();

    expect(sources.length).toBeGreaterThan(1);
    expect(sources.filter(({ source }) => /model-connections/.test(source))).toEqual([]);
  });

  it('keeps the credential-bearing connection type confined to client-side persistence code', () => {
    const sources = serverBoundarySources();

    expect(sources.some(({ path }) => path === serverAction)).toBe(true);
    expect(sources.filter(({ source }) => /\bcredential\b/.test(source))).toEqual([]);
  });
});
