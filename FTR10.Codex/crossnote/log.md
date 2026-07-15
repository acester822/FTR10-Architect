Packages: +1266
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 1315, reused 1270, downloaded 0, added 1266, done

> markdown-preview-enhanced@0.8.22 prepare /home/ftr/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced
> husky install

husky - Git hooks installed

dependencies:
+ @types/crypto-js 4.2.2
+ @types/vfile 3.0.2 (4.0.0 is available)
+ async-mutex 0.4.1 (0.5.0 is available)
+ crossnote 0.9.20
+ crypto-js 4.2.0

devDependencies:
+ @types/cheerio 0.22.11 (1.0.0 is available)
+ @types/mocha 5.2.7 (10.0.10 is available)
+ @types/node 16.18.126 (25.5.0 is available)
+ @types/vscode 1.70.0 (1.110.0 is available)
+ @typescript-eslint/eslint-plugin 6.21.0 (8.58.0 is available)
+ @typescript-eslint/parser 6.21.0 (8.58.0 is available)
+ @vscode/test-web 0.0.67 (0.0.80 is available)
+ concurrently 8.2.2 (9.2.1 is available)
+ esbuild 0.25.12 (0.27.4 is available)
+ esbuild-plugin-polyfill-node 0.3.0
+ eslint 8.57.1 (10.1.0 is available) deprecated
+ gulp 4.0.2 (5.0.1 is available)
+ http-server 14.1.1
+ husky 8.0.3 (9.1.7 is available)
+ lint-staged 9.5.0 (16.4.0 is available)
+ mocha 6.2.3 (11.7.5 is available)
+ prettier 1.19.1 (3.8.1 is available)
+ prettier-plugin-packagejson 2.5.22 (3.0.2 is available)
+ ts-loader 9.5.4
+ typescript 5.9.3 (6.0.2 is available)
+ webpack 5.105.4
+ webpack-cli 5.1.4 (7.0.2 is available)

╭ Warning ──────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                               │
│   Ignored build scripts: @playwright/browser-chromium@1.58.2, es5-ext@0.10.64,                │
│   esbuild@0.25.12, sharp@0.33.5.                                                              │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.      │
│                                                                                               │
╰───────────────────────────────────────────────────────────────────────────────────────────────╯
Done in 9.5s using pnpm v10.33.0
2) Build extension

> markdown-preview-enhanced@0.8.22 build /home/ftr/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced
> gulp copy-files && gulp clean-out && node build.js

[19:52:59] Using gulpfile ~/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced/gulpfile.js
[19:52:59] Starting 'copy-files'...
Copy files done.
[19:52:59] Finished 'copy-files' after 22 ms
[19:53:00] Using gulpfile ~/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced/gulpfile.js
[19:53:00] Starting 'clean-out'...
[19:53:00] Finished 'clean-out' after 4.63 ms
(node:3444524) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
(Use `node --trace-deprecation ...` to show where the warning was created)
3) Package extension to VSIX
Executing prepublish script 'npm run vscode:prepublish'...
(node:3444623) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated.
(Use `node --trace-deprecation ...` to show where the warning was created)

> markdown-preview-enhanced@0.8.22 vscode:prepublish
> pnpm install && pnpm build

 WARN  deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.
 WARN  22 deprecated subdependencies found: @humanwhocodes/config-array@0.13.0, @humanwhocodes/object-schema@2.0.3, @koa/router@13.1.1, @types/minimatch@6.0.0, @types/vfile-message@2.0.0, debug@3.2.6, fsevents@1.2.13, glob@7.1.3, glob@7.2.3, har-validator@5.1.5, inflight@1.0.6, mkdirp@0.5.4, request@2.88.2, resolve-url@0.2.1, rimraf@2.6.3, rimraf@3.0.2, source-map-resolve@0.5.3, source-map-url@0.4.1, urix@0.1.0, uuid@3.4.0, whatwg-encoding@2.0.0, whatwg-encoding@3.1.1
Packages: +1
+
Progress: resolved 1315, reused 1270, downloaded 0, added 1, done

> markdown-preview-enhanced@0.8.22 prepare /home/ftr/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced
> husky install

husky - Git hooks installed
╭ Warning ──────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                               │
│   Ignored build scripts: @playwright/browser-chromium@1.58.2, es5-ext@0.10.64,                │
│   esbuild@0.25.12, sharp@0.33.5.                                                              │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.      │
│                                                                                               │
╰───────────────────────────────────────────────────────────────────────────────────────────────╯
Done in 2.6s using pnpm v10.33.0

> markdown-preview-enhanced@0.8.22 build /home/ftr/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced
> gulp copy-files && gulp clean-out && node build.js

[19:53:05] Using gulpfile ~/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced/gulpfile.js
[19:53:05] Starting 'copy-files'...
Copy files done.
[19:53:05] Finished 'copy-files' after 18 ms
[19:53:06] Using gulpfile ~/AAA.MOD.MPE.CROSSNOTE/vscode-markdown-preview-enhanced/gulpfile.js
[19:53:06] Starting 'clean-out'...
[19:53:06] Finished 'clean-out' after 4.24 ms
(node:3444755) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
(Use `node --trace-deprecation ...` to show where the warning was created)
 DONE  Packaged: markdown-preview-enhanced-0.8.22.vsix (214 files, 10.68MB)
4) Install packaged extension
Installing extensions on coder.ftr10.dev...
Extension 'markdown-preview-enhanced-0.8.22.vsix' was successfully installed.
\n✅ Installed markdown-preview-enhanced-0.8.22.vsix successfully.
To run in dev mode (for debugging):
 