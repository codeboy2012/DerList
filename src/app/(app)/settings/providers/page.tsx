/**
 * Legacy Providers Page — redirects to the new Integrations page.
 */

import { redirect } from 'next/navigation';

export default function ProvidersPage() {
  redirect('/settings/integrations');
}
