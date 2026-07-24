import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /admin/waitlist/export
 *
 * Exports all waitlist entries as a CSV file.
 * Protected — requires ADMIN or OWNER role.
 */
export async function GET() {
  await requireAdmin();

  const entries = await prisma.waitlist.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      name: true,
      email: true,
      interest: true,
      newsletter: true,
      createdAt: true,
      approvedAt: true,
    },
  });

  // Build CSV
  const headers = ['Name', 'Email', 'Interest', 'Newsletter', 'Signed Up', 'Status'];
  const rows = entries.map((entry) => [
    escapeCsv(entry.name),
    escapeCsv(entry.email),
    escapeCsv(entry.interest),
    entry.newsletter ? 'Yes' : 'No',
    entry.createdAt.toISOString(),
    entry.approvedAt ? 'Approved' : 'Pending',
  ]);

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="derlist-waitlist-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
