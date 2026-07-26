import { Settings } from 'lucide-react';
import { Card } from '@/components/ui';

export default function AdminProvidersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Provider Administration</h1>
      <Card className="p-8">
        <div className="space-y-4 text-center">
          <Settings className="text-muted-foreground mx-auto h-12 w-12" />
          <h2 className="text-lg font-medium">Admin provider management is being rebuilt</h2>
        </div>
      </Card>
    </div>
  );
}
