/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-to-img', 'pdfjs-dist'],
};

export default nextConfig;
