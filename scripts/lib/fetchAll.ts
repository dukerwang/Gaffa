/**
 * Reads every page of a PostgREST query. PostgREST stops at 1,000 rows and
 * reports success, so any read that can pass that size must page. Callers
 * order on a unique key so rows can't shift across a page boundary.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
