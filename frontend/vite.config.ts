// v1.2 - 添加版本检测支持，构建时生成 version.json
// v1.1 - Added code splitting for recharts, optimized build output
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 生成版本号的插件
function versionPlugin(): Plugin {
  const version = Date.now().toString();
  return {
    name: 'version-plugin',
    buildStart() {
      // 构建开始时生成 version.json 到 public 目录
      const versionData = JSON.stringify({ version, buildTime: new Date().toISOString() });
      fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), versionData);
      console.log(`[version-plugin] Generated version: ${version}`);
    },
    config() {
      // 注入版本号到环境变量
      return {
        define: {
          'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
        }
      };
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), versionPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Split recharts into separate chunk (lazy loaded)
              'charts': ['recharts'],
              // Split React into vendor chunk (cached separately)
              'vendor': ['react', 'react-dom'],
            }
          }
        }
      }
    };
});
