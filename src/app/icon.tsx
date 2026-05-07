import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0a0a0a",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: "#a3e635",
        }}
      >
        {"</>"}
      </div>
    ),
    { ...size },
  );
}
