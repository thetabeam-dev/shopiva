/**
 * Primary page heading. Keep one H1 per page with vision-related meaning.
 * @param {{ children: React.ReactNode, className?: string }} props
 */
export default function PageH1({ children, className = "" }) {
  return <h1 className={`page-h1${className ? ` ${className}` : ""}`}>{children}</h1>;
}
