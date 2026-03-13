import { z } from 'zod';

export const paginationSnapshotSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
  hasPrev: z.boolean(),
  hasNext: z.boolean(),
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
  visibleIds: z.array(z.string()),
});

export type PaginationSnapshot = z.infer<typeof paginationSnapshotSchema>;

export interface BuildPaginationSnapshotInput<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  getId: (item: TItem) => string;
}

export function buildPaginationSnapshot<TItem>(
  input: BuildPaginationSnapshotInput<TItem>
): PaginationSnapshot {
  const total = input.items.length;
  const pageSize = Math.max(1, Math.floor(input.pageSize));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(input.page)), totalPages);
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = total === 0 ? 0 : Math.min(startIndex + pageSize, total);
  const visibleIds = input.items.slice(startIndex, endIndex).map(input.getId);

  return paginationSnapshotSchema.parse({
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    startIndex,
    endIndex,
    visibleIds,
  });
}
