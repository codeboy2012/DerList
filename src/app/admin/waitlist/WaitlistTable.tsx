'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';

import { BulkActions, WaitlistRowActions } from './WaitlistActions';

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  interest: string;
  newsletter: boolean;
  createdAt: Date;
  approvedAt: Date | null;
}

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  query: string;
}

/**
 * Client component for waitlist table — handles checkbox selection for bulk actions.
 */
export function WaitlistTable({ entries, query }: WaitlistTableProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const pendingEntries = entries.filter((e) => !e.approvedAt);
  const allPendingIds = pendingEntries.map((e) => e.id);

  const toggleAll = () => {
    if (selected.length === allPendingIds.length) {
      setSelected([]);
    } else {
      setSelected(allPendingIds);
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <>
      <BulkActions selectedIds={selected} onClear={() => setSelected([])} />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selected.length > 0 && selected.length === allPendingIds.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border bg-surface accent-accent"
                  aria-label="Select all pending entries"
                />
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Email</th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Interest</th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Joined</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {query ? 'No waitlist entries match your search.' : 'No waitlist entries yet.'}
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isPending = !entry.approvedAt;
                return (
                  <tr key={entry.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3">
                      {isPending ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(entry.id)}
                          onChange={() => toggleOne(entry.id)}
                          className="h-4 w-4 rounded border-border bg-surface accent-accent"
                          aria-label={`Select ${entry.name}`}
                        />
                      ) : (
                        <span className="block h-4 w-4" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{entry.name}</span>
                        <span className="text-xs text-muted-foreground md:hidden">{entry.email}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="text-foreground">{entry.email}</span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="text-xs text-muted-foreground">{entry.interest}</span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.approvedAt ? (
                        <Badge variant="success">Approved</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <WaitlistRowActions entryId={entry.id} isPending={isPending} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
