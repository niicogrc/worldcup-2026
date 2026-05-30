import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "flagcdn.com" },
      { hostname: "api.dicebear.com" },
      // Supabase Storage (avatars bucket)
      { hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
