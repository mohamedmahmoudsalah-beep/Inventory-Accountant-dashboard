export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 4C15 4 9 11 9 20c0 7 5 11 9 11 3.2 0 5-2 5-4.5S21 22 18 22c-2 0-3 1.4-3 3"
        stroke="var(--accent-2)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24 44c9 0 15-7 15-16 0-7-5-11-9-11-3.2 0-5 2-5 4.5s2.5 4.5 5.5 4.5c2 0 3-1.4 3-3"
        stroke="var(--accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
