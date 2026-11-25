import { useMemo, useState, type ReactNode } from 'react';
import { cx } from '../utils';

export type SortDirection = 'ascending' | 'descending';
type SortValue = string | number | bigint | Date | null | undefined;

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. Defaults to String(row[key]). */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting. Supplying it makes the column sortable. */
  sortValue?: (row: T) => SortValue;
  align?: 'start' | 'end';
  /** Render this column's cells as row headers (<th scope="row">). */
  rowHeader?: boolean;
}

export interface TableProps<T> {
  /** Required for accessibility; can be visually hidden. */
  caption: ReactNode;
  hideCaption?: boolean;
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  initialSort?: { key: string; direction: SortDirection };
  emptyState?: ReactNode;
  density?: 'comfortable' | 'compact';
  className?: string;
}

function compare(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // nulls last
  if (b === null || b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Data table with keyboard-accessible column sorting and aria-sort state. */
export function Table<T>({
  caption,
  hideCaption,
  columns,
  rows,
  getRowKey,
  initialSort,
  emptyState = 'No results',
  density = 'comfortable',
  className,
}: TableProps<T>) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.direction === 'ascending' ? 1 : -1;
    // Decorate-sort-undecorate keeps the sort stable for equal keys.
    return rows
      .map((row, index) => ({ row, index, value: col.sortValue!(row) }))
      .sort((x, y) => compare(x.value, y.value) * factor || x.index - y.index)
      .map((x) => x.row);
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => ({ key, direction: s?.key === key && s.direction === 'ascending' ? 'descending' : 'ascending' }));

  return (
    <div className={cx('tally-table-wrap', className)}>
      <table className={cx('tally-table', `tally-table--${density}`)}>
        <caption className={cx('tally-table__caption', hideCaption && 'tally-visually-hidden')}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={cx(col.align === 'end' && 'tally-table__cell--end')}
                  aria-sort={col.sortValue ? (active ? sort!.direction : 'none') : undefined}
                >
                  {col.sortValue ? (
                    <button type="button" className="tally-table__sort" onClick={() => toggle(col.key)}>
                      {col.header}
                      <span className={cx('tally-table__sort-icon', active && `tally-table__sort-icon--${sort!.direction}`)} aria-hidden="true" />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="tally-table__empty">
                {emptyState}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((col) => {
                  const content = col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? '');
                  const cls = cx(col.align === 'end' && 'tally-table__cell--end');
                  return col.rowHeader ? (
                    <th key={col.key} scope="row" className={cls}>
                      {content}
                    </th>
                  ) : (
                    <td key={col.key} className={cls}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
