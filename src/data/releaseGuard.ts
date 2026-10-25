import type { Status } from './schemas';

const FORBIDDEN: ReadonlySet<Status> = new Set(['GAP', 'PLACEHOLDER']);

export type ValuedLike = {
  value: unknown;
  status: Status;
  sourceRefs: string[];
};

/**
 * Walk shipped data and collect every {value,status,sourceRefs} leaf.
 * Release guard fails if any status is GAP or PLACEHOLDER, or sourceRefs is empty.
 */
export function collectValued(
  node: unknown,
  path = '',
  out: { path: string; status: Status; sourceRefs: string[] }[] = [],
): { path: string; status: Status; sourceRefs: string[] }[] {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      collectValued(item, `${path}[${String(i)}]`, out);
    });
    return out;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (
      'value' in obj &&
      'status' in obj &&
      'sourceRefs' in obj &&
      typeof obj.status === 'string' &&
      Array.isArray(obj.sourceRefs)
    ) {
      out.push({
        path: path || '(root)',
        status: obj.status as Status,
        sourceRefs: obj.sourceRefs as string[],
      });
      return out;
    }
    for (const [k, v] of Object.entries(obj)) {
      collectValued(v, path ? `${path}.${k}` : k, out);
    }
  }
  return out;
}

export type ReleaseGuardResult = {
  ok: boolean;
  valuedCount: number;
  failures: { path: string; reason: string }[];
};

export function runReleaseGuard(dataRoots: Record<string, unknown>): ReleaseGuardResult {
  const failures: { path: string; reason: string }[] = [];
  let valuedCount = 0;
  for (const [name, root] of Object.entries(dataRoots)) {
    const leaves = collectValued(root, name);
    valuedCount += leaves.length;
    for (const leaf of leaves) {
      if (FORBIDDEN.has(leaf.status)) {
        failures.push({
          path: leaf.path,
          reason: `forbidden status ${leaf.status}`,
        });
      }
      if (leaf.sourceRefs.length === 0) {
        failures.push({
          path: leaf.path,
          reason: 'empty sourceRefs',
        });
      }
    }
  }
  return { ok: failures.length === 0, valuedCount, failures };
}
