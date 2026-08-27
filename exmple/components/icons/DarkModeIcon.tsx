interface DarkModeIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function DarkModeIcon({ width = 18, height = 18, color = "currentColor", className }: DarkModeIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.4" d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M21.5 14.0784C20.503 18.3324 16.6849 21.5 12.1269 21.5C6.8101 21.5 2.5 17.1899 2.5 11.8731C2.5 7.31513 5.66765 3.49698 9.92163 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

