import { ImageResponse } from "next/og";

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
  // Padding ratio to prevent icon touching edges (e.g. 10% padding)
  const availableSize = size * 0.8;

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
          width={availableSize}
          height={availableSize}
          viewBox="0 0 245 245" // Approximate square viewBox for the symbol part
          fill="#95C948"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Symbol Part Only */}
          <rect x="228.2" width="25" height="25" />
          <g transform="translate(0, 0)">
            {/* The symbol is the 'U' shape on the left. 
                Original viewBox is 0 0 595.6 245.2.
                The symbol seems to be around x:0 to x:200 + the middle rect.
                Actually the description of SVG is a bit complex.
                Looking at the paths:
                First path: M98.5... (This is the U shape)
                Rect x=228.2 (This is the dot/separator)
                Second path: M444.9... (This looks like 'C')
                Third path: M595.6... (This looks like 'M' or 'R')
                
                The user wants the icon. Usually just the symbol.
                The symbol is the first path + maybe the rect.
                Let's use the first path and center it.
             */}
            <path d="M98.5,47.6c-29.2,0-55.5,12.8-73.5,33V0H0v145.9l0,0c0,0.1,0,0.2,0,0.3c0,54.3,44.2,98.5,98.5,98.5 s98.5-44.2,98.5-98.5S152.9,47.6,98.5,47.6L98.5,47.6z M98.5,219.7c-40.5,0-73.5-33-73.5-73.5s33-73.5,73.5-73.5s73.5,33,73.5,73.5 S139.1,219.7,98.5,219.7L98.5,219.7z" />
          </g>
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
