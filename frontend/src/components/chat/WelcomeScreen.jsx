export default function WelcomeScreen({ userName, onStart }) {
  return (
    <div className="flex flex-col items-center text-center p-12 px-6 animate-fadeUp max-w-md mx-auto">
      <div className="text-6xl mb-5">🌿</div>

      <h1 className="font-display text-3xl text-sage-900 mb-3.5 tracking-tight">
        Welcome, {userName}
      </h1>

      <p className="text-stone-600 text-base leading-relaxed mb-7">
        Start a new session to share what's on your mind.
        This is a safe, judgment-free space where your thoughts and feelings matter.
      </p>

      {/* Features */}
      <div className="grid grid-cols-2 gap-2.5 mb-8 w-full max-w-90">
        <div className="flex items-center gap-2 bg-warm-white border border-stone-200 rounded-xl p-2 px-3 text-xs font-medium text-stone-600">
          <div className="w-1.5 h-1.5 rounded-full bg-sage-400" />
          <span>Private</span>
        </div>
        <div className="flex items-center gap-2 bg-warm-white border border-stone-200 rounded-xl p-2 px-3 text-xs font-medium text-stone-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Supportive</span>
        </div>
        <div className="flex items-center gap-2 bg-warm-white border border-stone-200 rounded-xl p-2 px-3 text-xs font-medium text-stone-600">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span>Real-time</span>
        </div>
        <div className="flex items-center gap-2 bg-warm-white border border-stone-200 rounded-xl p-2 px-3 text-xs font-medium text-stone-600">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>Analytics</span>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStart}
        className="p-3.75 px-10 bg-emerald-700 text-white border-none rounded-3xl font-body text-lg font-medium cursor-pointer min-w-55 min-h-13 flex items-center justify-center shadow-tab transition-all duration-200 hover:bg-emerald-800 hover:-translate-y-0.5"
      >
        Start Conversation
      </button>

      {/* Disclaimer */}
      <p className="mt-6 text-xs text-stone-500 leading-relaxed">
        This is a supportive tool, not a substitute for professional mental health care.
        <br />
        If you're in crisis, please call the Nepal National Helpline at <strong className="text-stone-600">1166</strong>.
      </p>
    </div>
  )
}
