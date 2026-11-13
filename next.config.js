/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next transpileert node_modules standaard niet. De supabase-client bevat
  // moderne syntax die de oude WebKit van een Kobo niet aankan; door hem mee
  // te transpileren wordt hij volgens .browserslistrc naar ES5 gecompileerd.
  transpilePackages: ["@supabase/supabase-js"],
};

module.exports = nextConfig;
