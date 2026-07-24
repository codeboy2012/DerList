/**
 * Brand icons. lucide-react intentionally removed third-party brand logos
 * (GitHub, X, etc.) — so we keep only the brand marks we actually need,
 * and the rule "prefer lucide-react" is preserved for everything else.
 */

import { forwardRef, type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const;

export const GithubIcon = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg ref={ref} {...baseProps} {...props}>
    <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.01 3.24 9.26 7.74 10.76.57.1.78-.25.78-.55v-1.94c-3.15.68-3.82-1.52-3.82-1.52-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.51-.29-5.16-1.26-5.16-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.01 0 0 .95-.31 3.13 1.16.91-.25 1.88-.38 2.85-.39.97.01 1.94.14 2.85.39 2.17-1.47 3.12-1.16 3.12-1.16.62 1.56.23 2.72.11 3.01.73.79 1.17 1.8 1.17 3.04 0 4.35-2.65 5.31-5.17 5.59.41.35.78 1.05.78 2.12v3.14c0 .3.21.66.79.55 4.5-1.5 7.73-5.74 7.73-10.75C23.33 5.56 18.27.5 12 .5Z" />
  </svg>
));
GithubIcon.displayName = 'GithubIcon';
