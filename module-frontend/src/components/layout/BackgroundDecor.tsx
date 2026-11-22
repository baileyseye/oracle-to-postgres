export function BackgroundDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="glow glow-oracle" />
      <div className="glow glow-pg" />
      <div className="engineering-grid" />
      <div className="vignette-layer" />
      <div className="noise-layer" />
    </div>
  );
}
