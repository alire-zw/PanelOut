interface LockIconProps {
  width?: number | string
  height?: number | string
  color?: string
  className?: string
  locked?: boolean
}

export default function LockIcon({
  width = 18,
  height = 18,
  color = 'currentColor',
  className,
  locked = true,
}: LockIconProps) {
  if (!locked) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M7 10V8C7 5.23858 9.23858 3 12 3C14.0503 3 15.8124 4.2341 16.584 6"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          opacity="0.4"
          d="M16.4799 10H18.5C19.3284 10 20 10.6716 20 11.5V19.5C20 20.3284 19.3284 21 18.5 21H5.5C4.67157 21 4 20.3284 4 19.5V11.5C4 10.6716 4.67157 10 5.5 10H16.4799Z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 14V17"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7.5 10V8C7.5 5.51472 9.51472 3.5 12 3.5C14.4853 3.5 16.5 5.51472 16.5 8V10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        opacity="0.4"
        d="M5.5 10H18.5C19.3284 10 20 10.6716 20 11.5V19.5C20 20.3284 19.3284 21 18.5 21H5.5C4.67157 21 4 20.3284 4 19.5V11.5C4 10.6716 4.67157 10 5.5 10Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 14V17"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
