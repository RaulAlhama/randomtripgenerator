import { useState } from 'react';
import { typeIcons, typeLabels } from '../../constants/poi';

export default function PlaceItem({ place, index }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const label = typeLabels[place.type] || typeLabels.default;
  const [imgError, setImgError] = useState(false);

  return (
    <div className="poi-item">
      <div className="poi-number">{index + 1}</div>
      <div className="poi-content">
        {place.imageUrl && !imgError && (
          <div className="poi-image-wrapper">
            <img
              src={place.imageUrl}
              alt={place.name}
              className="poi-image"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        <div className="poi-name">{icon} {place.name}</div>
        <div className="poi-type">{label}</div>
        {place.description && (
          <div className="poi-description">{place.description}</div>
        )}
      </div>
    </div>
  );
}
