// Skeleton placeholder shown while a trip is being generated.
// Mirrors the final TripResult layout so the page doesn't "jump" when data arrives.

function SkeletonPlaceItem({ index }) {
  return (
    <div className="poi-item poi-item-skeleton" style={{ '--i': index }} aria-hidden="true">
      <div className="poi-number skeleton" />
      <div className="poi-content">
        <div className="poi-image-wrapper skeleton" />
        <div className="skeleton skeleton-line skeleton-line-short" />
        <div className="skeleton skeleton-line skeleton-line-title" />
        <div className="skeleton skeleton-line skeleton-line-full" />
      </div>
    </div>
  );
}

export default function TripSkeleton({ count = 4 }) {
  return (
    <>
      <div className="trip-cover trip-cover-skeleton" aria-hidden="true">
        <div className="trip-cover-title">
          <div className="skeleton skeleton-line skeleton-line-heading" style={{ width: '180px', height: '20px', background: 'rgba(255,255,255,0.3)', margin: 0 }} />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
            <div className="skeleton" style={{ width: '74px', height: '20px', borderRadius: '999px', background: 'rgba(255,255,255,0.3)' }} />
            <div className="skeleton" style={{ width: '64px', height: '20px', borderRadius: '999px', background: 'rgba(255,255,255,0.3)' }} />
            <div className="skeleton" style={{ width: '54px', height: '20px', borderRadius: '999px', background: 'rgba(255,255,255,0.3)' }} />
          </div>
        </div>
      </div>
      <div className="trip-grid" aria-hidden="true">
        <div className="map-wrapper skeleton skeleton-map" />
        <div className="places-panel">
          <div className="skeleton skeleton-line skeleton-line-title" />
          <div className="poi-list">
            {Array.from({ length: count }).map((_, i) => (
              <SkeletonPlaceItem key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
