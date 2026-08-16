/**
 * Packs a sparse set of checked cell ids into a compact, URL-safe string for
 * sharing, using run-length encoding: sort ascending, group into runs of
 * consecutive ids, then for each run emit two varints — the gap since the
 * previous run ended, and the run's length — and base64url the bytes.
 *
 * Real usage marks contiguous patches of ground as searched while walking, so
 * this collapses a 100-cell patch into a handful of bytes. A plain delta-per-id
 * scheme would cost roughly one byte per cell regardless of adjacency; RLE only
 * loses to it when checks are scattered in near-isolation (a run length of 1
 * costs the same either way), which isn't how this app gets used in practice.
 */
export function encodeCheckedCells(ids: Iterable<number>): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const bytes: number[] = [];
  let cursor = 0;
  let i = 0;

  while (i < sorted.length) {
    const runStart = sorted[i];
    let runEnd = runStart;
    while (i + 1 < sorted.length && sorted[i + 1] === runEnd + 1)
      runEnd = sorted[++i];

    pushVarint(bytes, runStart - cursor);
    pushVarint(bytes, runEnd - runStart + 1);
    cursor = runEnd + 1;
    i++;
  }

  return toBase64Url(new Uint8Array(bytes));
}

export function decodeCheckedCells(encoded: string): number[] {
  const bytes = fromBase64Url(encoded);
  const ids: number[] = [];
  let cursor = 0;
  let offset = 0;

  while (offset < bytes.length) {
    let gap: number;
    let runLength: number;
    [gap, offset] = readVarint(bytes, offset);
    [runLength, offset] = readVarint(bytes, offset);

    cursor += gap;
    for (let n = 0; n < runLength; n++)
      ids.push(cursor + n);
    cursor += runLength;
  }

  return ids;
}

function pushVarint(bytes: number[], value: number): void {
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
}

function readVarint(bytes: Uint8Array, offset: number): [value: number, nextOffset: number] {
  let value = 0;
  let shift = 0;

  for (;;) {
    const byte = bytes[offset++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80))
      return [value, offset];
    shift += 7;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes)
    binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
