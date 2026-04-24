export default function Card({ children, className = '' }) {
  return (
    <div className={`
      bg-warm-white border border-stone-200 rounded-3xl
      shadow-sm shadow-stone-800/8
      p-12 w-full max-w-sm
      animate-fadeUp
      ${className}
    `}>
      {children}
    </div>
  )
}
