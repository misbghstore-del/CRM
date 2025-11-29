import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 256,
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
      ...size,
    }
  );
}
