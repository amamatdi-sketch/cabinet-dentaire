import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Cabinet Dr. Amin & Dr. Bossioda",
        short_name: "Cabinet Dentaire",
        description: "Gestion du cabinet dentaire",
        theme_color: "#0f172a",
        background_color: "#f1f5f9",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Met en cache tous les fichiers de l'app
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Stratégie pour les requêtes Supabase : réseau d'abord, cache si hors-ligne
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/jeidktusskhegopcpppw\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
