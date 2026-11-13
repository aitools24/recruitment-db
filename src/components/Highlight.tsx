/** Render ts_headline output where matches are wrapped in [[[ ]]] — safe, no HTML injection. */
export default function Highlight({ text }: { text: string }) {
  const parts = text.split(/(\[\[\[.*?\]\]\])/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("[[[") ? <mark key={i}>{p.slice(3, -3)}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}
