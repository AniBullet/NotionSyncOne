import { defineConfig } from 'vite';
import { resolve } from 'path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// 获取项目根目录
const root = resolve(__dirname);

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
  plugins: [
    electron([
      {
          // Main process - 支持热重载
        entry: resolve(root, 'src/main/index.ts'),
        onstart(options) {
            // 开发模式下重启 Electron
            if (process.env.VSCODE_DEBUG) {
              console.log('[startup] Electron App');
            }
          options.startup();
        },
        vite: {
          build: {
            outDir: resolve(root, 'out/main'),
              minify: isProduction ? 'esbuild' : false,
              sourcemap: !isProduction, // 生产环境不生成 sourcemap
              watch: isProduction ? null : {}, // 生产环境不监听
            rollupOptions: {
              external: ['electron', 'fs']
            }
          }
        }
      },
      {
          // Preload script - 自动重载
        entry: resolve(root, 'src/preload/index.ts'),
        onstart(options) {
            // 预加载脚本改变时重载渲染进程
          options.reload();
        },
        vite: {
          build: {
            outDir: resolve(root, 'out/preload'),
              minify: isProduction ? 'esbuild' : false,
              sourcemap: !isProduction,
              watch: isProduction ? null : {}
          }
        }
      }
    ]),
    renderer()
  ],
  root: resolve(root, 'src/renderer'),
  publicDir: resolve(root, 'public'),
  build: {
    outDir: resolve(root, 'out/renderer'),
      emptyOutDir: true,
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks: isProduction ? {
            'vendor': ['react', 'react-dom']
          } : undefined
        }
      }
  },
  server: {
    port: 5173,
      strictPort: false,
      host: '127.0.0.1',
      hmr: {
        overlay: true,
        protocol: 'ws',
        host: '127.0.0.1',
      },
      watch: {
        usePolling: false,
        interval: 100,
      },
    headers: {
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 http://127.0.0.1:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:5173 ws://localhost:5173 http://127.0.0.1:5173 ws://127.0.0.1:5173;"
    }
  },
  resolve: {
    alias: {
      '@': resolve(root, 'src')
    }
  },
  base: './',
  optimizeDeps: {
    exclude: ['electron']
  },
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer')
      ]
    }
  }
  };
}); 