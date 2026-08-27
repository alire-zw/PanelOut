interface ArrowLeftIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function ArrowLeftIcon({ width = 18, height = 18, color = "currentColor", className }: ArrowLeftIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.4" d="M5.5 12.002H19" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M10.9999 18.002C10.9999 18.002 4.99998 13.583 4.99997 12.0019C4.99996 10.4208 11 6.00195 11 6.00195" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

