/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Customer app moved from /customer/* to index routes
      {
        source: "/customer",
        destination: "/",
        permanent: true,
      },
      {
        source: "/customer/vendors",
        destination: "/vendors",
        permanent: true,
      },
      {
        source: "/customer/vendors/:path*",
        destination: "/vendors/:path*",
        permanent: true,
      },
      {
        source: "/customer/user-profile",
        destination: "/user-profile",
        permanent: true,
      },
      {
        source: "/customer/user-profile/:path*",
        destination: "/user-profile/:path*",
        permanent: true,
      },
      {
        source: "/customer/store/:path*",
        destination: "/store/:path*",
        permanent: true,
      },

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
        source: "/:id/privacy-policy",
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
        source: "/:id/terms-of-use",
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
        source: "/:id/about",
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
      {
        source: "/:id/legal",
        destination: "/legal",
        permanent: true,
      },

      // Remaining legacy /customer/:id/* marketing pages → /:id/*
      {
        source: "/customer/:id/:path*",
        destination: "/:id/:path*",
        permanent: true,
      },
      {
        source: "/customer/:id",
        destination: "/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
