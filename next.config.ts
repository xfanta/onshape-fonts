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
        ],
      },
    ];
  },
};

export default nextConfig;
