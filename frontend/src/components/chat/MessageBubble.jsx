import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message, isUser, isConclusion }) {
  if (isConclusion) {
    const formattedMessage = message.replace(
      /(##\s+(?:I Hear You|What I'm Observing|Why You Might Be Feeling This Way|Coping Strategies|Recommended Next Steps|Crisis Resources))/gi,
      '\n\n$1\n\n'
    );

    return (
      <div className="flex w-full animate-fadeUp my-6">
        <div className="w-full max-w-3xl mx-auto rounded-2xl border border-sage-300 bg-white shadow-sm overflow-hidden">
          <div className="bg-sage-50 px-5 py-3 border-b border-sage-200 flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="text-xs font-bold text-sage-800 uppercase tracking-widest">
              Assessment Complete
            </span>
          </div>
          <div className="p-6">
            <ReactMarkdown
              components={{
                h2: ({ ...props }) => (
                  <h2 className="text-xl font-display font-bold text-sage-800 mt-6 mb-3 pt-4 border-t border-sage-100 first:mt-0 first:pt-0 first:border-0" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="text-stone-700 leading-relaxed mb-4 last:mb-0" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="list-disc pl-5 mb-4 text-stone-700 space-y-1" {...props} />
                ),
                li: ({ ...props }) => (
                  <li className="leading-relaxed" {...props} />
                )
              }}
            >
              {formattedMessage}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex items-end gap-2.5 justify-end animate-fadeUp">
        <div className="max-w-[min(480px,80%)] p-3.5 px-4.5 rounded-3xl rounded-br text-base leading-relaxed bg-sage-700 text-white">
          {message}
        </div>
        <div className="w-8.5 h-8.5 rounded-full bg-sage-700 text-white flex items-center justify-center text-xs font-semibold tracking-wide flex-shrink-0">
          You
        </div>
      </div>
    )
  }

  // Bot message
  return (
    <div className="flex items-end gap-2.5 animate-fadeUp">
      <div className="w-8.5 h-8.5 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-green-300">
        🤖
      </div>
      <div className="max-w-[min(480px,80%)] p-3.5 px-4.5 rounded-3xl rounded-bl text-base leading-relaxed bg-warm-white text-stone-800 border-2 border-stone-300 shadow-card">
        {message}
      </div>
    </div>
  )
}
