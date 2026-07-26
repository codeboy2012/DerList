import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { Card } from '@/components/ui';

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Shopping Assistant</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered shopping help — find products, compare prices, build PCs.
        </p>
      </div>

      <Card className="p-8">
        <div className="space-y-4 text-center">
          <MessageSquare className="text-muted-foreground mx-auto h-12 w-12" />
          <h2 className="text-lg font-medium">Shopping assistant is being rebuilt</h2>
          <p className="text-muted-foreground mx-auto max-w-md">
            We&apos;re redesigning the assistant to be smarter and more integrated. In the meantime,
            you can still add products manually or by URL.
          </p>
        </div>
      </Card>
    </div>
  );
}
