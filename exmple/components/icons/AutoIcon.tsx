interface AutoIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function AutoIcon({ width = 18, height = 18, color = "currentColor", className }: AutoIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.4" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M12 6V2M12 22V18M18 12H22M2 12H6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

