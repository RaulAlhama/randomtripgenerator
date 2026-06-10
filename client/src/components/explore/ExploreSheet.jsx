import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Draggable bottom sheet with three snap points (peek / half / full).
// On desktop (>=900px) it docks as a fixed left panel and dragging is disabled.

const SNAP_ORDER = ['full', 'half', 'peek'];

function useDocked() {
  const [docked, setDocked] = useState(
    () => window.matchMedia('(min-width: 900px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = (e) => setDocked(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return docked;
}

export default function ExploreSheet({ snap, onSnapChange, handle, refreshing, children }) {
  const docked = useDocked();
  const sheetRef = useRef(null);
  const handleRef = useRef(null);
  const dragRef = useRef(null);
  const [sheetH, setSheetH] = useState(0);
  const [handleH, setHandleH] = useState(140);
  const [dragY, setDragY] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      if (sheetRef.current) setSheetH(sheetRef.current.getBoundingClientRect().height);
      if (handleRef.current) setHandleH(handleRef.current.getBoundingClientRect().height);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Header content changes between stages (candidates vs route) — keep peek height in sync.
  useEffect(() => {
    if (!handleRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (handleRef.current) setHandleH(handleRef.current.getBoundingClientRect().height);
    });
    ro.observe(handleRef.current);
    return () => ro.disconnect();
  }, []);

  const offsetFor = (s) => {
    if (s === 'full') return 0;
    if (s === 'half') return Math.max(0, sheetH * 0.48);
    return Math.max(0, sheetH - handleH);
  };

  const clamp = (y) => Math.min(Math.max(y, 0), Math.max(0, sheetH - handleH));

  const onPointerDown = (e) => {
    if (docked) return;
    if (e.target.closest('button, a, input')) return;
    dragRef.current = {
      startY: e.clientY,
      startOffset: dragY ?? offsetFor(snap),
      lastY: e.clientY,
      lastT: performance.now(),
      vel: 0,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    const now = performance.now();
    d.vel = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    setDragY(clamp(d.startOffset + dy));
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;

    if (!d.moved) {
      // Tap on the handle cycles upward: peek → half → full → half.
      setDragY(null);
      onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half');
      return;
    }

    let next;
    if (Math.abs(d.vel) > 0.5) {
      // Flick: advance one snap in the flick direction.
      const idx = SNAP_ORDER.indexOf(snap);
      next = d.vel > 0
        ? SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, idx + 1)]
        : SNAP_ORDER[Math.max(0, idx - 1)];
    } else {
      const y = dragY ?? offsetFor(snap);
      next = SNAP_ORDER.reduce((best, s) =>
        Math.abs(y - offsetFor(s)) < Math.abs(y - offsetFor(best)) ? s : best
      );
    }
    setDragY(null);
    onSnapChange(next);
  };

  const transform = docked
    ? undefined
    : `translate3d(0, ${dragY ?? offsetFor(snap)}px, 0)`;

  const className = [
    'xp-sheet',
    docked ? 'is-docked' : '',
    dragY != null ? 'is-dragging' : '',
    refreshing ? 'is-refreshing' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={sheetRef} className={className} style={{ transform }}>
      <div
        ref={handleRef}
        className="xp-sheet-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!docked && <div className="xp-grabber" aria-hidden="true" />}
        {refreshing && <div className="xp-refresh-bar" aria-hidden="true" />}
        {handle}
      </div>
      <div className="xp-sheet-body">{children}</div>
    </div>
  );
}
