/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Bare version path → canonical schema document.
      {
        source: "/v2",
        destination: "/v2/vaultlier.schema.json",
        permanent: false,
      },
      // Convenience: /schema and root point at the current schema.
      {
        source: "/schema",
        destination: "/v2/vaultlier.schema.json",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
