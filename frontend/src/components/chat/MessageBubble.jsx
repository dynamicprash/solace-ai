import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message, isUser }) {
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
