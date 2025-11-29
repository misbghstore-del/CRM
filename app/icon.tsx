import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

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

  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: size === 192 ? 96 : 256,
          background: "linear-gradient(to bottom right, #84cc16, #65a30d)", // Lime-500 to Lime-600
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: "20%", // Rounded corners for app icon look
        }}
      >
        CRM
      </div>
    ),
    // ImageResponse options
    {
      width: size,
      height: size,
    }
  );
}
