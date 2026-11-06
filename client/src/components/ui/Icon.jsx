import { ICONS } from '../../lib/icons';

// One of the app's line icons (lib/icons.js). Decorative unless given a
// title, in which case it's announced as an image with that name.
export default function Icon({ name, size = 16, strokeWidth = 2, className, style, title }) {
  const body = ICONS[name];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      // Static markup from lib/icons.js, never data.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
