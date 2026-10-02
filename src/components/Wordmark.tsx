/**
 * The word itself, cut in half: "half" stays, "sies" slides off along the cut.
 * Two runs of real text (screen readers read "halfsies"), no images.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      <span className="wordmark-a">half</span>
      <span className="wordmark-b">sies</span>
    </span>
  );
}
