export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 animate-fadeIn">
      <div className="w-8.5 h-8.5 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-green-300">
        🤖
      </div>
      <div className="bg-warm-white border-2 border-stone-300 rounded-2xl rounded-bl p-3.5 px-5 flex gap-1.25 items-center">
        <span className="w-1.75 h-1.75 bg-stone-600 rounded-full animate-pulse" />
        <span className="w-1.75 h-1.75 bg-stone-600 rounded-full animate-pulse animation-delay-200" />
        <span className="w-1.75 h-1.75 bg-stone-600 rounded-full animate-pulse animation-delay-400" />
      </div>
    </div>
  )
}
