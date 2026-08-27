interface SocialMediaIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export default function SocialMediaIcon({ width = 18, height = 18, color = "currentColor", className }: SocialMediaIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.4" d="M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M12 6C10 4 8.5 3.5 7 3.5C4.10526 3.5 2 5.82563 2 8.69444C2 13.0348 7.58942 17.858 10.4107 19.9677C10.8854 20.3227 11.4427 20.5001 12 20.5001" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

