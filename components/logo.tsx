import { cn } from "@/utils/cn";

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className, size = 32 }: LogoProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <rect width="32" height="32" rx="8" className="fill-primary/20" />
        <path
          d="M22 10H10C8.89543 10 8 10.8954 8 12V20C8 21.1046 8.89543 22 10 22H22C23.1046 22 24 21.1046 24 20V12C24 10.8954 23.1046 10 22 10Z"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 14L16 18L24 14"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="22"
          cy="22"
          r="3"
          className="fill-primary stroke-background"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
