'use client';

/**
 * ItemTree — Premium file-explorer-style nested item tree.
 *
 * Polished UX:
 * - Smooth grid-rows expand/collapse with opacity transition
 * - Perfect VS Code/GitHub connector lines (no broken segments)
 * - Parent items visually distinct with folder icon + metadata bar
 * - Bundle info as subtle metadata: "📦 4 Children • $312.98 Bundle • 2/4 Purchased"
 * - Drag with clear insertion indicator, invalid drop prevention
 * - Auto-expand collapsed parents after 600ms drag hover
 * - Auto-scroll when dragging near viewport edges
 * - Highlight pulse on new/moved items (3s fade)
 * - Keyboard accessible: arrow keys, enter, delete
 * - Mobile: touch targets, long-press context menu via grip handle
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { ChevronRight, FolderTree, GripVertical, Package as PackageIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ItemRow } from './ItemRow';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TreeItem {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  image: string | null;
  brand: string | null;
  retailer: string | null;
  currentPrice: string | null;
  originalPrice?: string | null;
  dealInfo?: string | null;
  currency: string;
  priority: string;
  starPriority: number;
  quantity: number;
  purchased: boolean;
  notes: string | null;
  category?: string | null;
  parentId: string | null;
  children: TreeItem[];
}

export interface ItemTreeProps {
  items: TreeItem[];
  wishlistId: string;
  onAddChild?: (parentId: string) => void;
  onDrop?: (draggedId: string, targetParentId: string | null) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  highlightedItemId?: string | null;
  onContextAction?: (action: string, itemId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function getBundleTotal(item: TreeItem): number {
  let total = Number(item.currentPrice) || 0;
  for (const child of item.children) total += getBundleTotal(child);
  return total;
}

export function getPurchaseProgress(item: TreeItem): { purchased: number; total: number } {
  let purchased = item.purchased ? 1 : 0;
  let total = 1;
  for (const child of item.children) {
    const p = getPurchaseProgress(child);
    purchased += p.purchased;
    total += p.total;
  }
  return { purchased, total };
}

export function getDescendantCount(item: TreeItem): number {
  let count = item.children.length;
  for (const child of item.children) count += getDescendantCount(child);
  return count;
}

export function getAllParentIds(items: TreeItem[]): string[] {
  const ids: string[] = [];
  function walk(nodes: TreeItem[]) {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  }
  walk(items);
  return ids;
}

/** Check if targetId is a descendant of sourceId (prevent invalid drops) */
function isDescendantOf(sourceId: string, targetId: string, items: TreeItem[]): boolean {
  function find(nodes: TreeItem[]): TreeItem | null {
    for (const n of nodes) {
      if (n.id === sourceId) return n;
      const found = find(n.children);
      if (found) return found;
    }
    return null;
  }
  function hasDescendant(node: TreeItem, id: string): boolean {
    for (const child of node.children) {
      if (child.id === id) return true;
      if (hasDescendant(child, id)) return true;
    }
    return false;
  }
  const source = find(items);
  return source ? hasDescendant(source, targetId) : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INDENT_PX = 24;
const AUTO_EXPAND_DELAY = 600;
const AUTO_SCROLL_ZONE = 60; // px from edge

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ItemTree({
  items,
  wishlistId,
  onAddChild,
  onDrop,
  expandedNodes,
  onToggleExpand,
  highlightedItemId,
  onContextAction,
}: ItemTreeProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll during drag
  const handleContainerDragOver = useCallback((e: DragEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    if (y < AUTO_SCROLL_ZONE) {
      scrollIntervalRef.current = setInterval(() => {
        container.scrollBy({ top: -8 });
      }, 16);
    } else if (y > height - AUTO_SCROLL_ZONE) {
      scrollIntervalRef.current = setInterval(() => {
        container.scrollBy({ top: 8 });
      }, 16);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOverId(null);
    setDraggedId(null);
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-0.5"
      role="tree"
      aria-label="Wishlist items"
      onDragOver={isDragging ? handleContainerDragOver : undefined}
      onDragEnd={handleDragEnd}
    >
      {items.map((item, index) => (
        <TreeNode
          key={item.id}
          item={item}
          allItems={items}
          wishlistId={wishlistId}
          depth={0}
          isLast={index === items.length - 1}
          onAddChild={onAddChild}
          onDrop={onDrop}
          expandedNodes={expandedNodes}
          onToggleExpand={onToggleExpand}
          highlightedItemId={highlightedItemId}
          dragOverId={dragOverId}
          setDragOverId={setDragOverId}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          draggedId={draggedId}
          setDraggedId={setDraggedId}
          onContextAction={onContextAction}
        />
      ))}

      {/* Root drop zone */}
      {onDrop && isDragging && (
        <div
          className={cn(
            'mt-1.5 rounded-xl border-2 border-dashed px-4 py-2.5 text-center text-[11px] font-medium transition-all duration-200',
            dragOverId === '__root__'
              ? 'border-accent/60 bg-accent/5 text-accent'
              : 'border-border/40 text-muted-foreground/60'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverId('__root__');
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            if (id) onDrop(id, null);
            handleDragEnd();
          }}
        >
          Drop here to make top-level
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node
// ─────────────────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  item: TreeItem;
  allItems: TreeItem[];
  wishlistId: string;
  depth: number;
  isLast: boolean;
  onAddChild?: (parentId: string) => void;
  onDrop?: (draggedId: string, targetParentId: string | null) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  highlightedItemId?: string | null;
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onContextAction?: (action: string, itemId: string) => void;
}

function TreeNode({
  item,
  allItems,
  wishlistId,
  depth,
  isLast,
  onAddChild,
  onDrop,
  expandedNodes,
  onToggleExpand,
  highlightedItemId,
  dragOverId,
  setDragOverId,
  isDragging,
  setIsDragging,
  draggedId,
  setDraggedId,
  onContextAction,
}: TreeNodeProps) {
  const hasChildren = item.children.length > 0;
  const isExpanded = expandedNodes.has(item.id);
  const isHighlighted = highlightedItemId === item.id;
  const isDropTarget = dragOverId === item.id;
  const isBeingDragged = draggedId === item.id;
  const autoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent dropping onto self or own descendants
  const isValidDropTarget = draggedId
    ? draggedId !== item.id && !isDescendantOf(draggedId, item.id, allItems)
    : true;

  // Bundle stats
  const childCount = hasChildren ? getDescendantCount(item) : 0;
  const bundleTotal = hasChildren ? getBundleTotal(item) : 0;
  const progress = hasChildren ? getPurchaseProgress(item) : null;

  // ─── Drag ───

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';
      setIsDragging(true);
      setDraggedId(item.id);
    },
    [item.id, setIsDragging, setDraggedId]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isValidDropTarget) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.dataTransfer.dropEffect = 'move';
      setDragOverId(item.id);

      // Auto-expand collapsed parent
      if (hasChildren && !isExpanded && !autoExpandTimer.current) {
        autoExpandTimer.current = setTimeout(() => {
          onToggleExpand(item.id);
          autoExpandTimer.current = null;
        }, AUTO_EXPAND_DELAY);
      }
    },
    [item.id, setDragOverId, hasChildren, isExpanded, onToggleExpand, isValidDropTarget]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
    if (autoExpandTimer.current) {
      clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }
  }, [setDragOverId]);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isValidDropTarget) return;
      const id = e.dataTransfer.getData('text/plain');
      if (id && id !== item.id && onDrop) onDrop(id, item.id);
      setDragOverId(null);
      setIsDragging(false);
      setDraggedId(null);
      if (autoExpandTimer.current) {
        clearTimeout(autoExpandTimer.current);
        autoExpandTimer.current = null;
      }
    },
    [item.id, onDrop, setDragOverId, setIsDragging, setDraggedId, isValidDropTarget]
  );

  useEffect(
    () => () => {
      if (autoExpandTimer.current) clearTimeout(autoExpandTimer.current);
    },
    []
  );

  // ─── Keyboard ───

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      switch (e.key) {
        case 'ArrowRight':
          if (hasChildren && !isExpanded) {
            e.preventDefault();
            onToggleExpand(item.id);
          }
          break;
        case 'ArrowLeft':
          if (hasChildren && isExpanded) {
            e.preventDefault();
            onToggleExpand(item.id);
          }
          break;
        case 'Enter':
          e.preventDefault();
          onContextAction?.('edit', item.id);
          break;
        case 'Delete':
          e.preventDefault();
          onContextAction?.('delete-branch', item.id);
          break;
      }
    },
    [hasChildren, isExpanded, item.id, onToggleExpand, onContextAction]
  );

  // ─── Connector geometry ───
  const lineLeft = depth * INDENT_PX - 12;

  return (
    <div
      data-tree-node
      data-item-id={item.id}
      className={cn('relative', isBeingDragged && 'opacity-40')}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ─── Connector Lines (VS Code style) ─── */}
      {depth > 0 && (
        <>
          {/* Vertical guide line */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${lineLeft}px`,
              top: 0,
              bottom: isLast ? '50%' : 0,
              width: '1px',
              background: 'var(--border)',
            }}
            aria-hidden
          />
          {/* Horizontal branch */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${lineLeft}px`,
              top: '28px',
              width: '12px',
              height: '1px',
              background: 'var(--border)',
            }}
            aria-hidden
          />
        </>
      )}

      {/* ─── Node Content ─── */}
      <div
        style={{ paddingLeft: `${depth * INDENT_PX}px` }}
        className={cn(
          'relative transition-all duration-200',
          // Drop target indicator
          isDropTarget && isValidDropTarget && 'ring-accent/40 bg-accent/[0.02] rounded-xl ring-2',
          isDropTarget && !isValidDropTarget && 'ring-danger/30 bg-danger/[0.02] rounded-xl ring-2',
          // New item highlight (3s pulse then fade)
          isHighlighted &&
            'ring-accent/50 ring-offset-background animate-[pulse_1s_ease-in-out_3] rounded-xl ring-2 ring-offset-1'
        )}
        draggable={!!onDrop}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ─── Parent Metadata Bar ─── */}
        {hasChildren && (
          <div className="flex items-center gap-2 px-1 py-1.5 select-none">
            {/* Chevron */}
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="text-muted-foreground hover:text-foreground hover:bg-surface flex h-5 w-5 items-center justify-center rounded-md transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>

            {/* Folder icon */}
            <FolderTree className="text-accent/60 h-3.5 w-3.5 flex-shrink-0" />

            {/* Metadata string: "4 Children • $312.98 Bundle • 2/4 Purchased" */}
            <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="tabular-nums">
                {childCount} {childCount === 1 ? 'child' : 'children'}
              </span>
              {bundleTotal > 0 && (
                <>
                  <span className="text-border">•</span>
                  <span className="tabular-nums">${bundleTotal.toFixed(2)} bundle</span>
                </>
              )}
              {progress && progress.total > 1 && (
                <>
                  <span className="text-border">•</span>
                  <span
                    className={cn(
                      'tabular-nums',
                      progress.purchased === progress.total && 'text-success'
                    )}
                  >
                    {progress.purchased}/{progress.total} purchased
                  </span>
                </>
              )}
            </span>

            {/* Progress bar */}
            {progress && progress.total > 1 && (
              <div className="bg-border/50 ml-1 h-1 w-10 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    progress.purchased === progress.total ? 'bg-success' : 'bg-accent/60'
                  )}
                  style={{ width: `${(progress.purchased / progress.total) * 100}%` }}
                />
              </div>
            )}

            {/* Drag handle (mobile touch target) */}
            {onDrop && (
              <GripVertical className="text-muted-foreground/20 hover:text-muted-foreground ml-auto h-3.5 w-3.5 cursor-grab touch-manipulation active:cursor-grabbing" />
            )}
          </div>
        )}

        {/* ─── Item Card ─── */}
        <div
          className={cn(
            depth > 0 && 'ml-1',
            depth > 0 && depth <= 2 && '[&>div>article]:rounded-xl [&>div>article]:py-3',
            depth > 2 && '[&>div>article]:rounded-lg [&>div>article]:py-2'
          )}
        >
          <ItemRow
            item={item}
            wishlistId={wishlistId}
            onAddChild={onAddChild}
            onContextAction={onContextAction}
            isParent={hasChildren}
            depth={depth}
          />
        </div>
      </div>

      {/* ─── Children (animated) ─── */}
      {hasChildren && (
        <div
          data-children
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
            isExpanded
              ? 'grid-rows-[1fr] opacity-100'
              : 'pointer-events-none grid-rows-[0fr] opacity-0'
          )}
          role="group"
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-0.5 pt-0.5">
              {item.children.map((child, idx) => (
                <TreeNode
                  key={child.id}
                  item={child}
                  allItems={allItems}
                  wishlistId={wishlistId}
                  depth={depth + 1}
                  isLast={idx === item.children.length - 1}
                  onAddChild={onAddChild}
                  onDrop={onDrop}
                  expandedNodes={expandedNodes}
                  onToggleExpand={onToggleExpand}
                  highlightedItemId={highlightedItemId}
                  dragOverId={dragOverId}
                  setDragOverId={setDragOverId}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  draggedId={draggedId}
                  setDraggedId={setDraggedId}
                  onContextAction={onContextAction}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
