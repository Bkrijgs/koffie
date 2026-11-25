/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next transpileert node_modules standaard niet. De supabase-client bevat
  // moderne syntax die de oude WebKit van een Kobo niet aankan; door hem mee
  // te transpileren wordt hij volgens .browserslistrc naar ES5 gecompileerd.
  transpilePackages: ["@supabase/supabase-js"],
  experimental: {
    // Het Kobo-dashboard leest zijn lettertypes van schijf; zonder dit komen
    // de bestanden niet mee in de serverless functie op Vercel.
    outputFileTracingIncludes: {
      "/kobo/dashboard.png": ["./app/kobo/fonts/*"],
    },
  },
};

module.exports = nextConfig;
