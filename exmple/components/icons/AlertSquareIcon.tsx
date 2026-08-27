interface AlertSquareIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function AlertSquareIcon({ width = 18, height = 18, color = "currentColor", className }: AlertSquareIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path opacity="0.4" d="M12 8V12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path opacity="0.4" d="M12 15.9883V15.9983" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}


