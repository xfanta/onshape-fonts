import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Local Font Access API needs an explicit permissions-policy on
        // the top-level document. Defaults block it; we whitelist self.
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "local-fonts=(self)",
          },
          // A response is what its Content-Type says, never sniffed.
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
