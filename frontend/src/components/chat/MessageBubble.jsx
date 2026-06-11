import ReactMarkdown from 'react-markdown';
import Logo from '../common/Logo';

export default function MessageBubble({ message, isUser, prediction }) {
  if (isUser) {
    const primaryEmotion = prediction?.primary_emotion
    
    return (
      <div className="flex flex-col items-end gap-1.5 justify-end w-full animate-fadeUp">
        <div className="flex items-end gap-2.5 justify-end w-full">
          <div className="max-w-[min(640px,90%)] p-3.5 px-4.5 rounded-3xl rounded-br text-base leading-relaxed bg-sage-700 text-white">
            {message}
          </div>
          <div className="w-8.5 h-8.5 rounded-full bg-sage-700 text-white flex items-center justify-center text-xs font-semibold tracking-wide flex-shrink-0">
            You
          </div>
        </div>
        {primaryEmotion && (
          <div className="mr-11 text-[10px] text-sage-600/70 font-semibold uppercase tracking-wider flex items-center gap-1.5 animate-fadeIn">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>AI NLP Indicator: {primaryEmotion}</span>
          </div>
        )}
      </div>
    )
  }

  // Bot message
  return (
    <div className="flex items-end gap-2.5 animate-fadeUp">
      <div className="w-8.5 h-8.5 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 border border-sage-200 select-none p-1">
        <Logo className="w-full h-full" />
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
