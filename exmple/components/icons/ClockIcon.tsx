interface ClockIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function ClockIcon({ width = 12, height = 12, color = "currentColor", className }: ClockIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></circle>
      <path d="M12 6V12L16 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

