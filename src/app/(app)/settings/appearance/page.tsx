import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';
import { AppearanceSettings } from './AppearanceSettings';

export const metadata: Metadata = {
  title: `Appearance — ${siteConfig.name}`,
};

export default function AppearanceSettingsPage() {
  return <AppearanceSettings />;
}
