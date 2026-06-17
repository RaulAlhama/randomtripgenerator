import { useEffect, useRef, useState } from 'react';

// Full-screen horizontal card deck. Controlled: the parent owns `index` and
// receives changes via `onIndexChange`, so it can advance the deck itself
// (e.g. auto-advance after a card is removed). Each card fills the viewport;
// dragging horizontally pages between them with a flick threshold.
export default function ExploreDeck({
  count,
  index,
  onIndexChange,
  renderCard,
  header,
  footer,
}) {
  const trackRef = useRef(null);
  const drag = useRef(null); // { startX, startT, dx, width }
  const [dragX, setDragX] = useState(null);

  const clamp = (i) => Math.max(0, Math.min(count - 1, i));
  const go = (i) => onIndexChange(clamp(i));

  // Keep the index valid if the deck shrinks.
  useEffect(() => {
    if (index > count - 1) onIndexChange(clamp(count - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const onPointerDown = (e) => {
    if (e.target.closest('button, a, input')) return;
    const width = trackRef.current?.offsetWidth || window.innerWidth;
    drag.current = { startX: e.clientX, startT: Date.now(), dx: 0, width };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    let dx = e.clientX - drag.current.startX;
    // Rubber-band at the ends so it doesn't feel broken.
    if ((index === 0 && dx > 0) || (index === count - 1 && dx < 0)) dx *= 0.35;
    drag.current.dx = dx;
    setDragX(dx);
  };

  const endDrag = (e) => {
    if (!drag.current) return;
    const { dx, width, startT } = drag.current;
    const dt = Date.now() - startT;
    const velocity = dx / Math.max(dt, 1); // px/ms
    const flick = Math.abs(velocity) > 0.5 && Math.abs(dx) > 12;
    const past = Math.abs(dx) > width * 0.28;
    if ((flick || past) && Math.abs(dx) > 8) {
      go(dx < 0 ? index + 1 : index - 1);
    }
    drag.current = null;
    setDragX(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const basePct = -index * 100;
  const dragPct = dragX != null && trackRef.current
    ? (dragX / trackRef.current.offsetWidth) * 100
    : 0;

  return (
    <div className="xp-deck">
      {header}

      <div className="xp-deck-stage">
        <div
          ref={trackRef}
          className={`xp-deck-track${dragX != null ? ' is-dragging' : ''}`}
          style={{ transform: `translate3d(${basePct + dragPct}%, 0, 0)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {Array.from({ length: count }).map((_, i) => (
            <div className="xp-deck-cell" key={i} aria-hidden={i !== index}>
              {/* Render neighbours only — keeps image loads and DOM light. */}
              {Math.abs(i - index) <= 1 ? renderCard(i) : null}
            </div>
          ))}
        </div>
      </div>

      {footer}
    </div>
  );
}
