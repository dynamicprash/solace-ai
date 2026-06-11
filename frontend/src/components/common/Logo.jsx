export default function Logo({ className = "w-8 h-8", style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6a9e69" />
          <stop offset="100%" stopColor="#3a6640" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="#f7f4ee" />
      <g transform="translate(16, 16) scale(4)">
        <path
          d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 2 5.5a7 7 0 0 1-13.8 2.1"
          fill="url(#leafGrad)"
        />
        <path
          d="M19 2c-2.26 4.33-5.27 7.14-8 10"
          stroke="#f7f4ee"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
