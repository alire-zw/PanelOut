interface ArrowBackIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function ArrowBackIcon({ width = 20, height = 20, color = "currentColor", className }: ArrowBackIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.4" d="M18.5 12L4.99997 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

