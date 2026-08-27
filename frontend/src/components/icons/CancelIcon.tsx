interface CancelIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function CancelIcon({ width = 18, height = 18, color = "currentColor", className }: CancelIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M9 9L15 15M15 9L9 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

