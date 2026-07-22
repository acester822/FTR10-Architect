// Standalone build for FTR10 Architect (theme engine).
// Compiles the extension host entry (src/extension.ts) into the CJS bundle
// that VS Code / code-server loads (package.json "main": ./out/native/extension.js).
//
// The old monorepo built a second "web" entry (src/extension-web.ts) and bundled
// the Crossnote markdown-preview runtime. That code is gone — this extension is
// only the theme engine, so we produce a single native bundle.
const { context, build } = require('esbuild');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(b) {
    b.onStart(() => console.log('[watch] build started'));
    b.onEnd((result) => {
      if (result.errors.length) {
        result.errors.forEach((error) =>
          console.error(
            `> ${error.location?.file}:${error.location?.line}:${error.location?.column}: error: ${error.text}`,
          ),
        );
      } else {
        console.log('[watch] build finished');
      }
    });
  },
};

/**
 * @type {import('esbuild').BuildOptions}
 */
const nativeConfig = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  minify: false,
  platform: 'node', // VS Code extension host is CJS
  outfile: './out/native/extension.js',
  target: 'node16',
  format: 'cjs',
  mainFields: ['main', 'module'],
  conditions: ['require', 'node'],
  external: ['vscode'],
  // Shadow the navigator getter before any module runs to avoid
  // PendingMigrationError from the VS Code extension host.
  // See: https://aka.ms/vscode-extensions/navigator
  banner: {
    js: '(function(){try{Object.defineProperty(globalThis,"navigator",{value:{userAgent:"nodejs",platform:"nodejs",clipboard:{writeText:function(){return Promise.resolve();},write:function(){return Promise.resolve();}}},configurable:true,writable:true,enumerable:true});}catch(e){}})();',
  },
};

async function main() {
  try {
    if (process.argv.includes('--watch')) {
      const nativeContext = await context({
        ...nativeConfig,
        sourcemap: true,
        minify: false,
        plugins: [esbuildProblemMatcherPlugin],
      });
      await nativeContext.watch();
    } else {
      await build(nativeConfig);
      console.log('build complete: out/native/extension.js');
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
