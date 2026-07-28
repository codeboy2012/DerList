'use client';

/**
 * ItemTreeWrapper — Manages tree state and connects it to the modal/API layer.
 *
 * - localStorage persistence for expanded/collapsed state per wishlist
 * - Expand All / Collapse All support
 * - Add Child modal with breadcrumb
 * - Drag to nest/unnest with API persistence
 * - Scroll-to + highlight pulse on newly added children
 * - Context menu action dispatching
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Modal, useDisclosure } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { UniversalInput } from '@/components/product';
import { getAllParentIds, ItemTree, type TreeItem } from './ItemTree';
import { TreeToolbar } from './TreeToolbar';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ItemTreeWrapperProps {
  items: TreeItem[];
  wishlistId: string;
  /** Ref for toolbar to call expandAll / collapseAll */
  controlRef?: React.RefObject<TreeControls | null>;
}

export interface TreeControls {
  expandAll: () => void;
  collapseAll: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'derlist_tree_expanded_';

function loadExpandedState(wishlistId: string, items: TreeItem[]): Set<string> {
  if (typeof window === 'undefined') return new Set(getAllParentIds(items));
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${wishlistId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr as string[]);
    }
  } catch {
    /* ignore */
  }
  // Default: all parents expanded
  return new Set(getAllParentIds(items));
}

function saveExpandedState(wishlistId: string, expanded: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${wishlistId}`, JSON.stringify([...expanded]));
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ItemTreeWrapper({ items, wishlistId, controlRef }: ItemTreeWrapperProps) {
  const router = useRouter();
  const toast = useToast();
  const modal = useDisclosure();
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [addingParentTitle, setAddingParentTitle] = useState<string>('');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() =>
    loadExpandedState(wishlistId, items)
  );
  const treeRef = useRef<HTMLDivElement>(null);

  // Persist expanded state on change
  useEffect(() => {
    saveExpandedState(wishlistId, expandedNodes);
  }, [expandedNodes, wishlistId]);

  // Expose controls for toolbar
  useEffect(() => {
    if (controlRef && 'current' in controlRef) {
      const mutableRef = controlRef as React.MutableRefObject<TreeControls | null>;
      mutableRef.current = {
        expandAll: () => {
          setExpandedNodes(new Set(getAllParentIds(items)));
        },
        collapseAll: () => {
          setExpandedNodes(new Set());
        },
      };
    }
  }, [controlRef, items]);

  // ─── Toggle Expand ───

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // ─── Add Child ───

  const handleAddChild = useCallback(
    (parentId: string) => {
      function findTitle(nodes: TreeItem[]): string {
        for (const node of nodes) {
          if (node.id === parentId) return node.title;
          const found = findTitle(node.children);
          if (found) return found;
        }
        return '';
      }
      setAddingParentId(parentId);
      setAddingParentTitle(findTitle(items));
      modal.onOpen();
    },
    [items, modal]
  );

  // ─── After Child Saved ───

  const handleChildSaved = useCallback(() => {
    modal.onClose();

    // Expand the parent
    if (addingParentId) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.add(addingParentId);
        return next;
      });
    }

    router.refresh();

    // Scroll to + highlight new child after DOM updates
    setTimeout(() => {
      if (addingParentId && treeRef.current) {
        const parentNode = treeRef.current.querySelector(
          `[data-tree-node] [data-item-id="${addingParentId}"]`
        );
        if (parentNode) {
          const treeNode = parentNode.closest('[data-tree-node]');
          const childrenEl = treeNode?.querySelector('[data-children]');
          if (childrenEl) {
            const allChildren = childrenEl.querySelectorAll('[data-item-id]');
            const lastChild = allChildren[allChildren.length - 1];
            if (lastChild) {
              lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const id = lastChild.getAttribute('data-item-id');
              if (id) {
                setHighlightedItemId(id);
                setTimeout(() => setHighlightedItemId(null), 3000);
              }
            }
          }
        }
      }
    }, 600);
  }, [addingParentId, modal, router]);

  // ─── Drag to Nest/Unnest ───

  const handleDrop = useCallback(
    async (draggedId: string, targetId: string | null) => {
      try {
        const res = await fetch(`/api/wishlists/items/${draggedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetId }),
        });

        if (!res.ok) {
          toast.error('Failed to move item');
          return;
        }

        // Expand the new parent so the moved item is visible
        if (targetId) {
          setExpandedNodes((prev) => {
            const next = new Set(prev);
            next.add(targetId);
            return next;
          });
        }

        // Highlight the moved item
        setHighlightedItemId(draggedId);
        setTimeout(() => setHighlightedItemId(null), 2000);

        router.refresh();
      } catch {
        toast.error('Failed to move item');
      }
    },
    [router, toast]
  );

  // ─── Context Menu Actions ───

  const handleContextAction = useCallback(
    async (action: string, itemId: string) => {
      switch (action) {
        case 'add-child':
          handleAddChild(itemId);
          break;

        case 'convert-to-root':
          await handleDrop(itemId, null);
          break;

        case 'duplicate-branch': {
          toast.success('Duplicating branch...');
          try {
            const res = await fetch(`/api/wishlists/items/${itemId}/duplicate`, { method: 'POST' });
            if (res.ok) {
              toast.success('Branch duplicated');
              router.refresh();
            } else {
              toast.error('Failed to duplicate');
            }
          } catch {
            toast.error('Failed to duplicate');
          }
          break;
        }

        case 'delete-branch':
        case 'delete-promote':
          // Handled by the DeleteBranchDialog in ItemRow
          break;
      }
    },
    [handleAddChild, handleDrop, router, toast]
  );

  const hasParents = getAllParentIds(items).length > 0;

  return (
    <>
      {/* Toolbar: Expand/Collapse All */}
      <TreeToolbar
        hasParents={hasParents}
        onExpandAll={() => setExpandedNodes(new Set(getAllParentIds(items)))}
        onCollapseAll={() => setExpandedNodes(new Set())}
      />

      <div ref={treeRef}>
        <ItemTree
          items={items}
          wishlistId={wishlistId}
          onAddChild={handleAddChild}
          onDrop={handleDrop}
          expandedNodes={expandedNodes}
          onToggleExpand={handleToggleExpand}
          highlightedItemId={highlightedItemId}
          onContextAction={handleContextAction}
        />
      </div>

      {/* Add Child Modal */}
      <Modal
        open={modal.open}
        onClose={modal.onClose}
        size="lg"
        title={
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-foreground max-w-[180px] truncate font-semibold">
              {addingParentTitle}
            </span>
            <ChevronRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
            <span className="text-accent font-medium">New Child</span>
          </div>
        }
        description="This item will be nested under the parent as part of the bundle."
      >
        <UniversalInput
          wishlistId={wishlistId}
          parentId={addingParentId ?? undefined}
          onItemAdded={handleChildSaved}
        />
      </Modal>
    </>
  );
}
