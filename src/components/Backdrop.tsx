import './Backdrop.css';

// Decorative scene behind the frosted-glass chrome: hazy blurred color
// pooling, motion-blurred light streaks, venetian-blind slats, and film
// grain — the "looking through a shuttered window" read for Gen X Soft
// Club. Purely visual, so it's hidden from the accessibility tree.
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-blob backdrop-blob--a" />
      <div className="backdrop-blob backdrop-blob--b" />
      <div className="backdrop-blob backdrop-blob--c" />
      <div className="backdrop-streak backdrop-streak--a" />
      <div className="backdrop-streak backdrop-streak--b" />
      <div className="backdrop-shutters" />
      <div className="backdrop-grain" />
    </div>
  );
}

export default Backdrop;
