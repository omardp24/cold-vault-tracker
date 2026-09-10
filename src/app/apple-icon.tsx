import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg, #F77B1C 0%, #F8B345 100%)",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 24 24" fill="none" stroke="#071A20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
          <circle cx="12" cy="11" r="2.2" fill="#071A20" />
          <path d="M12 13.2V15.6" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
