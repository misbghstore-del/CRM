import { ImageResponse } from "next/og";

// Route segment config
// export const runtime = "edge";

// Image metadata
export function generateImageMetadata() {
  return [
    {
      contentType: "image/png",
      size: { width: 192, height: 192 },
      id: "192",
    },
    {
      contentType: "image/png",
      size: { width: 512, height: 512 },
      id: "512",
    },
  ];
}

// Image generation
export default function Icon({ id }: { id: string }) {
  const size = id === "192" ? 192 : 512;
  const scale = size / 32; // Base size is 32x32

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background Rect */}
          <rect
            width="32"
            height="32"
            rx="8"
            fill="#ecfccb" // lime-100 (primary/20 approx)
          />

          {/* Envelope Body */}
          <path
            d="M22 10H10C8.89543 10 8 10.8954 8 12V20C8 21.1046 8.89543 22 10 22H22C23.1046 22 24 21.1046 24 20V12C24 10.8954 23.1046 10 22 10Z"
            stroke="#84cc16" // lime-500 (primary)
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Envelope Flap */}
          <path
            d="M8 14L16 18L24 14"
            stroke="#84cc16" // lime-500
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Notification Dot */}
          <circle
            cx="22"
            cy="22"
            r="3"
            fill="#84cc16" // lime-500
            stroke="#ffffff" // background
            strokeWidth="1.5"
          />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
