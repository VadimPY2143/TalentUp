interface AISparkleIconProps {
  className?: string
}

const AISparkleIcon = ({ className = "h-4 w-4" }: AISparkleIconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 3L14.25 8.75L20 11L14.25 13.25L12 19L9.75 13.25L4 11L9.75 8.75L12 3Z"
        fill="currentColor"
      />
      <path
        d="M19 3L19.7 4.8L21.5 5.5L19.7 6.2L19 8L18.3 6.2L16.5 5.5L18.3 4.8L19 3Z"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  )
}

export default AISparkleIcon
