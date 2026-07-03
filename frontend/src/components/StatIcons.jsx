export function ActiveStatIcon() {
  return (
    <span className="stat-icon stat-icon--active" aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.75" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
