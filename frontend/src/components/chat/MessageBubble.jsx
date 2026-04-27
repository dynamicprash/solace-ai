import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message, isUser, isConclusion }) {
  if (isConclusion) {
    const formattedMessage = message.replace(
      /(##\s+(?:I Hear You|What I'm Observing|Why You Might Be Feeling This Way|Coping Strategies|Recommended Next Steps|Crisis Resources))/gi,
      '\n\n$1\n\n'
    );

    return (
      <div className="flex w-full animate-fadeUp my-8">
        <div className="w-full max-w-3xl mx-auto rounded-3xl border border-sage-200 bg-white shadow-xl overflow-hidden">
          <div className="bg-sage-50/50 px-6 py-4 border-b border-sage-100 flex items-center gap-3">
            <div className="w-6 h-6 bg-sage-600 rounded flex items-center justify-center text-white text-[10px]">
              📋
            </div>
            <span className="text-[11px] font-bold text-sage-600 uppercase tracking-[0.2em]">
              Assessment Complete
            </span>
          </div>
          <div className="p-8 md:p-10">
            <ReactMarkdown
              components={{
                h2: ({ ...props }) => (
                  <h2 className="text-2xl font-display font-bold text-sage-800 mt-10 mb-5 pt-8 border-t border-sage-100 first:mt-0 first:pt-0 first:border-0" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="text-stone-600 text-[1.05rem] leading-[1.7] mb-5 last:mb-0" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="list-disc pl-5 mb-5 text-stone-600 space-y-2" {...props} />
                ),
                li: ({ ...props }) => (
                  <li className="leading-relaxed" {...props} />
                ),
                strong: ({ ...props }) => (
                  <strong className="font-bold text-sage-900" {...props} />
                )
              }}
            >
              {formattedMessage}
            </ReactMarkdown>
          </div>
          <div className="bg-sage-50/30 px-10 py-4 border-t border-sage-100 flex justify-between items-center">
            <span className="text-[10px] text-stone-400 italic">Solace-AI Intelligence Report</span>
            <span className="text-[10px] text-sage-400 font-medium">Session Concluded</span>
          </div>
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex items-end gap-2.5 justify-end animate-fadeUp">
        <div className="max-w-[min(640px,90%)] p-3.5 px-4.5 rounded-3xl rounded-br text-base leading-relaxed bg-sage-700 text-white">
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
      <div className="w-8.5 h-8.5 rounded-full bg-sage-100 flex items-center justify-center text-lg flex-shrink-0 border border-sage-200">
        <div className="w-4 h-4 bg-sage-500 rounded-full" />
      </div>
      <div className="max-w-[min(640px,90%)] p-4 px-5 rounded-3xl rounded-bl text-[0.95rem] leading-relaxed bg-white text-stone-800 border border-slate-200 shadow-sm">
        <ReactMarkdown
          components={{
            p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
            strong: ({ ...props }) => <strong className="font-bold text-sage-800" {...props} />,
            ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
            a: ({ ...props }) => <a className="text-sage-600 underline hover:text-sage-700" {...props} />
          }}
        >
          {message}
        </ReactMarkdown>
      </div>
    </div>
  )
}
