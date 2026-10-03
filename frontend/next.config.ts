import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // In dev, proxy API calls to the FastAPI backend; in Docker it serves both.
    return {
      rewrites: async () => [
        { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
      ],
    };
  }
  return { output: "export" };
}
