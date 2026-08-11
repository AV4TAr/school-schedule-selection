"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface SheetAnchor {
  /** Viewport coordinates of the left edge and the bottom of the trigger. */
  x: number;
  y: number;
  /** Preferred width in px; ignored on a phone, where the sheet is full width. */
  width?: number;
}

/**
 * The one overlay primitive: an anchored popover on a wide screen, a bottom
 * sheet on a phone. Which one you get is decided entirely in CSS (see `.sheet`
 * in components.css) — this component never branches on viewport width to
 * render, so the server and the client always agree.
 *
 * Anchoring passes viewport coordinates through custom properties rather than
 * inline `left`/`top`, precisely so the phone branch can override them; setting
 * them inline would win over the media query and strand the sheet mid-screen.
 */
export function Sheet({
  anchor,
  title,
  onClose,
  children,
}: {
  /** Omit to dock the sheet under the top-right corner on wide screens. */
  anchor?: SheetAnchor | null;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Only the phone form is modal enough to justify freezing the page; on a
  // desktop popover a locked scrollbar would be a jarring side effect.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 47.999rem)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Focus moves in so the sheet is reachable by keyboard and announced by a
  // screen reader; where it came from is restored when the sheet closes.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => returnTo?.focus?.();
  }, []);

  // A sheet is only ever mounted in response to a tap, so `document` is always
  // there in practice; the guard is for the pathological case of one being
  // rendered open during SSR, where a portal has nowhere to go.
  if (typeof document === "undefined") return null;

  const style = anchor
    ? ({
        "--sheet-x": `${anchor.x}px`,
        "--sheet-y": `${anchor.y}px`,
        ...(anchor.width ? { "--sheet-w": `${anchor.width}px` } : {}),
      } as React.CSSProperties)
    : undefined;

  return createPortal(
    <>
      <div className="sheet-scrim no-print" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`sheet no-print ${anchor ? "" : "sheet-corner"}`}
        style={style}
      >
        {title && <p className="sheet-title">{title}</p>}
        {children}
      </div>
    </>,
    document.body,
  );
}

/**
 * Viewport rect of a trigger element, in the shape `Sheet` wants. Read it in
 * the click handler that opens the sheet — the sheet is `position: fixed`, so
 * these are already the right coordinates.
 */
export function anchorFrom(element: HTMLElement | null, width?: number): SheetAnchor | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const preferred = width ?? Math.max(rect.width, 220);
  // Keep the popover on screen when the trigger sits near the right edge.
  const x = Math.min(rect.left, window.innerWidth - preferred - 12);
  return { x: Math.max(12, x), y: rect.bottom + 6, width: preferred };
}
