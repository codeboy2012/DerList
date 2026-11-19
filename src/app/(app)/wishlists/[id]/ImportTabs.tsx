'use client';

/**
 * ImportTabs — dedicated, accessible tabs for each import method.
 *
 * Panels stay mounted while hidden so switching methods does not discard
 * partially entered URLs, text, research, or manual form fields.
 */
import { useRef, useState } from 'react';
import { Code2, FileUp, Link2, List, PencilLine, Search, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { UniversalInput } from '@/components/product';
import type { ExistingImportItem } from '@/components/product/ImportBatchReview';
import { AIResearchTab } from './AIResearchTab';
import { ImportUnavailableTab } from './ImportUnavailableTab';
import { ManualAddForm } from './ManualAddForm';
import { ProductLookupTab } from './ProductLookupTab';

type TabId = 'lookup' | 'url' | 'text' | 'website' | 'file' | 'research' | 'manual';

const tabs: Array<{
  id: TabId;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'lookup',
    label: 'Product Lookup',
    description:
      'Search your configured shopping provider, then pick a matching product to review.',
    icon: <Search className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 'url',
    label: 'Product URL',
    description:
      'Paste one or more product URLs. Retailer detection and page metadata use the existing importer.',
    icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 'text',
    label: 'Find Products from Text',
    description:
      'Paste copied product text or a shopping list. Every detected product is reviewed before saving.',
    icon: <List className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 'website',
    label: 'Website Data',
    description:
      'Paste structured website information. This build does not yet parse HTML, Markdown, JSON, or JSON-LD documents.',
    icon: <Code2 className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 'file',
    label: 'File Import',
    description: 'CSV and DerList export files. File import is not implemented in this build.',
    icon: <FileUp className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 'research',
    label: 'AI Research',
    description:
      'Fetch source data and an optional AI summary. AI-generated content is labeled separately.',
    icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 'manual',
    label: 'Manual Entry',
    description: 'Enter a product yourself. Only the product name is required.',
    icon: <PencilLine className="h-3.5 w-3.5" aria-hidden />,
  },
];

interface ImportTabsProps {
  wishlistId: string;
  wishlistTitle: string;
  categories: string[];
  existingItems: ExistingImportItem[];
}

export function ImportTabs({
  wishlistId,
  wishlistTitle,
  categories,
  existingItems,
}: ImportTabsProps) {
  const [active, setActive] = useState<TabId>('lookup');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex == null) return;

    event.preventDefault();
    setActive(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="min-w-0">
      <div className="border-border overflow-x-auto border-b">
        <div
          role="tablist"
          aria-label="Product import methods"
          className="flex w-max min-w-full gap-0.5 px-2 sm:px-4"
        >
          {tabs.map((tab, index) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`import-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`import-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-3 text-xs font-medium whitespace-nowrap transition-colors sm:px-3',
                  selected
                    ? 'border-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-muted-foreground px-4 pt-3 text-xs sm:px-6">{activeTab.description}</p>

      <div className="p-4 sm:p-6">
        <div
          role="tabpanel"
          id="import-panel-lookup"
          aria-labelledby="import-tab-lookup"
          hidden={active !== 'lookup'}
        >
          <ProductLookupTab
            wishlistId={wishlistId}
            wishlistTitle={wishlistTitle}
            existingItems={existingItems}
          />
        </div>

        <div
          role="tabpanel"
          id="import-panel-url"
          aria-labelledby="import-tab-url"
          hidden={active !== 'url'}
        >
          <UniversalInput
            wishlistId={wishlistId}
            wishlistTitle={wishlistTitle}
            categories={categories}
            existingItems={existingItems}
            mode="url"
            submitLabel="Import URL"
          />
        </div>

        <div
          role="tabpanel"
          id="import-panel-text"
          aria-labelledby="import-tab-text"
          hidden={active !== 'text'}
        >
          <UniversalInput
            wishlistId={wishlistId}
            wishlistTitle={wishlistTitle}
            categories={categories}
            existingItems={existingItems}
            mode="text"
            submitLabel="Detect products"
          />
        </div>

        <div
          role="tabpanel"
          id="import-panel-website"
          aria-labelledby="import-tab-website"
          hidden={active !== 'website'}
        >
          <ImportUnavailableTab kind="website" onSwitchTab={setActive} />
        </div>

        <div
          role="tabpanel"
          id="import-panel-file"
          aria-labelledby="import-tab-file"
          hidden={active !== 'file'}
        >
          <ImportUnavailableTab kind="file" onSwitchTab={setActive} />
        </div>

        <div
          role="tabpanel"
          id="import-panel-research"
          aria-labelledby="import-tab-research"
          hidden={active !== 'research'}
        >
          <AIResearchTab
            wishlistId={wishlistId}
            wishlistTitle={wishlistTitle}
            onSwitchTab={setActive}
          />
        </div>

        <div
          role="tabpanel"
          id="import-panel-manual"
          aria-labelledby="import-tab-manual"
          hidden={active !== 'manual'}
        >
          <ManualAddForm wishlistId={wishlistId} />
        </div>
      </div>
    </div>
  );
}
