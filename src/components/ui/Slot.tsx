import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

/**
 * Slot — render the child element and forward all props/refs onto it.
 *
 * Minimal Radix-style primitive used by `Button` (and any other component)
 * that wants `asChild` polymorphism. Avoids pulling in `@radix-ui/react-slot`
 * because the only behaviour we need is "merge props onto the single child".
 */
export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

function mergeProps(
  childProps: Record<string, unknown>,
  slotProps: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...childProps, ...slotProps };
  // Concatenate className
  const childClass = childProps.className;
  const slotClass = slotProps.className;
  if (typeof childClass === 'string' || typeof slotClass === 'string') {
    result.className = [childClass, slotClass].filter(Boolean).join(' ');
  }
  // Merge style objects
  const childStyle = childProps.style;
  const slotStyle = slotProps.style;
  if (
    typeof childStyle === 'object' &&
    childStyle !== null &&
    typeof slotStyle === 'object' &&
    slotStyle !== null
  ) {
    result.style = { ...(childStyle as object), ...(slotStyle as object) };
  }
  return result;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  return (value: T | null) => {
    refs.forEach((r) => {
      if (typeof r === 'function') r(value);
      else if (r && typeof r === 'object') {
        (r as { current: T | null }).current = value;
      }
    });
  };
}

export const Slot = forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, ref) => {
    const child = Children.only(children);
    if (!isValidElement(child)) return child as ReactNode;

    const childElement = child as ReactElement<{
      ref?: Ref<HTMLElement>;
      [key: string]: unknown;
    }>;
    const childProps = (childElement.props ?? {}) as Record<string, unknown>;
    const merged = mergeProps(childProps, slotProps as Record<string, unknown>);

    return cloneElement(childElement, {
      ...merged,
      ref: ref ? mergeRefs(ref, childProps.ref as Ref<HTMLElement>) : childProps.ref,
    } as Record<string, unknown>);
  },
);
Slot.displayName = 'Slot';
