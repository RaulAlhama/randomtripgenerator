import { useSaved, savedKey } from '../../context/SavedContext';

// Heart toggle overlaid on a deck card photo. Consumes the Saved context
// directly so callers only need to hand it the item to remember.
export default function SaveHeart({ item }) {
  const { isSaved, toggleSaved } = useSaved();
  const key = item.key || savedKey(item);
  const saved = isSaved(key);

  return (
    <button
      type="button"
      className={`xp-save${saved ? ' is-saved' : ''}`}
      onClick={(e) => { e.stopPropagation(); toggleSaved({ ...item, key }); }}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
