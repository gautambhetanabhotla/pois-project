import { serve } from "bun";
import index from "./index.html";

const server = serve({
  routes: {
    // Proxy all API requests to the backend.
    "/api/*": async req => {
      const targetUrl = new URL(req.url);
      targetUrl.protocol = "http:";
      targetUrl.hostname = "127.0.0.1";
      targetUrl.port = "8000";

      return fetch(new Request(targetUrl, req));
    },

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
