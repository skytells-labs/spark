import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0a0a0a",
          borderRadius: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -2,
          color: "#a3e635",
        }}
      >
        {"</>"}
      </div>
    ),
    { ...size },
  );
}
