import { cn } from "@/utils/cn";

interface LogoProps {
  className?: string;
  size?: number | string;
}

export default function Logo({ className, size = 150 }: LogoProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg
        version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        x="0px"
        y="0px"
        viewBox="0 0 595.6 245.2"
        xmlSpace="preserve"
        width={size}
        height="auto" // Maintain aspect ratio
        className="fill-[#95C948]"
      >
        <rect x="228.2" width="25" height="25" />
        <g>
          <path d="M98.5,47.6c-29.2,0-55.5,12.8-73.5,33V0H0v145.9l0,0c0,0.1,0,0.2,0,0.3c0,54.3,44.2,98.5,98.5,98.5 s98.5-44.2,98.5-98.5S152.9,47.6,98.5,47.6L98.5,47.6z M98.5,219.7c-40.5,0-73.5-33-73.5-73.5s33-73.5,73.5-73.5s73.5,33,73.5,73.5 S139.1,219.7,98.5,219.7L98.5,219.7z" />
          <rect x="228.2" y="47.3" width="25" height="196.4" />
          <path d="M444.9,152.5c0,37.3-30.4,67.7-67.7,67.7s-67.7-30.4-67.7-67.7V47.8h-25v104.8c0,51.1,41.6,92.7,92.7,92.7 s92.7-41.6,92.7-92.7V47.8h-25L444.9,152.5L444.9,152.5z" />
          <path d="M595.6,72.6v-25h-69.3V0h-25v186.5c0,31.7,25.8,57.5,57.5,57.5h36.8v-25h-36.8c-17.9,0-32.5-14.6-32.5-32.5 V72.6H595.6L595.6,72.6z" />
        </g>
      </svg>
    </div>
  );
}
