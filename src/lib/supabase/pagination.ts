/**
 * PostgREST caps a response at 1,000 rows and says nothing when it truncates —
 * an unpaginated `.select()` on a table past that size silently returns a
 * prefix. This has bitten the codebase repeatedly (`sofifa_position_reference`,
 * the player sync); `player_stats` crosses the threshold a few gameweeks into
 * every season.
 *
 * Any read that can exceed a thousand rows goes through here.
 */
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; count?: number | null }>,
): Promise<T[]> {
  const first = await run(0, PAGE_SIZE - 1);
  if (!first.data || first.data.length === 0) return [];
  const out: T[] = [...first.data];
  if (first.data.length < PAGE_SIZE) return out;

  const count = (first as { count?: number | null }).count;
  if (count != null && count > PAGE_SIZE) {
    const totalPages = Math.ceil(count / PAGE_SIZE);
    const BATCH_SIZE = 5;
    for (let i = 1; i < totalPages; i += BATCH_SIZE) {
      const batchPages: number[] = [];
      for (let p = i; p < Math.min(i + BATCH_SIZE, totalPages); p++) {
        batchPages.push(p);
      }
      const results = await Promise.all(
        batchPages.map((p) => run(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)),
      );
      for (const res of results) {
        if (res.data) out.push(...res.data);
      }
    }
    return out;
  }

  for (let page = 1; ; page++) {
    const { data } = await run(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>;

/**
 * `fetchAllPages`, but a failed page throws instead of ending the loop.
 *
 * `fetchAllPages` treats an error like an empty page and returns whatever it
 * had, which is the right trade for a page render. It is the wrong one for a
 * caller that writes from the result: the matchup processor would lock a score
 * computed from half a roster, and the player sync would mistake unread rows
 * for new players. Those callers use this.
 *
 * Order the query on a unique key. Without one, rows that tie on the sort can
 * move across a page boundary between requests and be read twice or not at all.
 */
export async function fetchAllPagesOrThrow<T>(
  run: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const first = await run(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);
  if (!first.data || first.data.length === 0) return [];
  const out: T[] = [...first.data];
  if (first.data.length < PAGE_SIZE) return out;

  const count = (first as { count?: number | null }).count;
  if (count != null && count > PAGE_SIZE) {
    const totalPages = Math.ceil(count / PAGE_SIZE);
    const BATCH_SIZE = 5;
    for (let i = 1; i < totalPages; i += BATCH_SIZE) {
      const batchPages: number[] = [];
      for (let p = i; p < Math.min(i + BATCH_SIZE, totalPages); p++) {
        batchPages.push(p);
      }
      const results = await Promise.all(
        batchPages.map((p) => run(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)),
      );
      for (const res of results) {
        if (res.error) throw new Error(res.error.message);
        if (res.data) out.push(...res.data);
      }
    }
    return out;
  }

  for (let page = 1; ; page++) {
    const { data, error } = await run(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

/** Ids per `.in()` filter. Each UUID adds ~37 characters to the request URL. */
export const ID_CHUNK_SIZE = 150;

/**
 * Every row matching an id list that may be too long for one request.
 *
 * Two limits, so two loops. The ids are chunked because they travel in the URL:
 * the matchup processor's gameweek read already carries ~270 of them, ~10KB.
 * Each chunk is then paged, because the ids do not bound the rows: one player
 * has a stats row per fixture, per season. Throws on a failed page, for the
 * reason `fetchAllPagesOrThrow` does.
 */
export async function fetchAllPagesIn<T>(
  ids: readonly string[],
  run: (chunk: string[], from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE);
    out.push(...(await fetchAllPagesOrThrow<T>((from, to) => run(chunk, from, to))));
  }
  return out;
}
