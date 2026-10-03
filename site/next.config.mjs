/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Consolidate duplicated legal/info pages onto global routes
      {
        source: "/entrepreneur/:id/privacy-policy",
        destination: "/privacy-policy",
        permanent: true,
      },
      {
        source: "/customer/:id/privacy-policy",
        destination: "/privacy-policy",
        permanent: true,
      },
      {
        source: "/entrepreneur/:id/terms-of-use",
        destination: "/terms-of-use",
        permanent: true,
      },
      {
        source: "/customer/:id/terms-of-use",
        destination: "/terms-of-use",
        permanent: true,
      },
      {
        source: "/entrepreneur/:id/about",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/customer/:id/about",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/entrepreneur/:id/legal",
        destination: "/legal",
        permanent: true,
      },
      {
        source: "/customer/:id/legal",
        destination: "/legal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
