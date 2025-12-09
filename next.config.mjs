/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.lego.com",
        pathname: "/cdn/**",
      },
    ],
  },
};

export default nextConfig;
