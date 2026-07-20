import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // ffmpeg-static locates its bundled binary via `path.join(__dirname, ...)`
      // at require-time. Bundling it rewrites that to the build output's
      // __dirname instead of node_modules/ffmpeg-static, so the binary can't
      // be found. Keep it as a real runtime require so __dirname stays correct.
      external: ['ffmpeg-static'],
    },
  },
});
