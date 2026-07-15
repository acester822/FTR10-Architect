const gulp = require('gulp');
const less = require('gulp-less');
const cleanCss = require('gulp-clean-css');
const path = require('path');
const fs = require('fs');

gulp.task('clean-out', function (cb) {
  // Delete ./out folder
  if (fs.existsSync('./out')) {
    fs.rmSync('./out', { recursive: true });
  }
  cb();
});

gulp.task('compile-less', function (cb) {
  // 1. Compile all *.less files in ./styles
  gulp
    .src('./styles/**/*.less')
    .pipe(
      less({
        paths: [
          path.join(__dirname, 'styles'),
          path.join(__dirname, 'styles/preview_theme'),
          path.join(__dirname, 'styles/prism_theme'),
        ],
      }),
    )
    .pipe(cleanCss())
    .pipe(gulp.dest('./out/styles'));

  // 2. Copy all files except *.less in ./styles to ./out/styles
  gulp
    .src(['./styles/**/*', '!./styles/**/*.less'])
    .pipe(cleanCss())
    .pipe(gulp.dest('./out/styles'));

  // 3. Copy local user fonts for preview font-face support.
  const userFontDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.ftr10', 'fonts');
  if (fs.existsSync(userFontDir)) {
    gulp.src(path.join(userFontDir, '**/*'))
      .pipe(gulp.dest('./out/fonts'));
  } else {
    console.warn(`Local fonts directory not found: ${userFontDir}. Skipping out/fonts copy.`);
  }

  cb();
});

// Whenever there is a change in ./styles, run 'compile-less' task
gulp.task('watch-less', function (cb) {
  gulp.watch('./styles/**/*', gulp.series('compile-less'));

  cb();
});

gulp.task('copy-files', function (cb) {
  // Copy ./dependencies to ./out
  if (fs.existsSync('./dependencies')) {
    gulp.src('./dependencies/**/*').pipe(gulp.dest('./out/dependencies'));
  } else {
    const copy = (src, dest) => {
      if (!fs.existsSync(src)) {
        console.warn(`Missing asset: ${src}`);
        return;
      }
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
    };

    const findPnpmPackageDir = (packageName) => {
      const pnpmDir = path.join(__dirname, 'node_modules/.pnpm');
      if (!fs.existsSync(pnpmDir)) {
        return null;
      }
      const normalized = packageName.replace('/', '+');
      const entries = fs.readdirSync(pnpmDir);
      const match = entries.find((entry) => entry.startsWith(`${normalized}@`));
      if (!match) {
        return null;
      }
      return path.join(pnpmDir, match, 'node_modules', ...packageName.split('/'));
    };

    const copyFromPnpm = (packageName, sourceRelative, dest) => {
      const pkgDir = findPnpmPackageDir(packageName);
      if (!pkgDir) {
        console.warn(`Unable to resolve package directory for ${packageName}`);
        return;
      }
      copy(path.join(pkgDir, sourceRelative), dest);
    };

    copyFromPnpm('katex', 'dist/katex.min.css', './out/dependencies/katex/katex.min.css');
    copyFromPnpm(
      '@fortawesome/fontawesome-free',
      'css/all.min.css',
      './out/dependencies/font-awesome/css/all.min.css',
    );
    copyFromPnpm('mermaid', 'dist/mermaid.min.js', './out/dependencies/mermaid/mermaid.min.js');
    copyFromPnpm('wavedrom', 'skins/default.js', './out/dependencies/wavedrom/skins/default.js');
    copyFromPnpm('wavedrom', 'skins/narrow.js', './out/dependencies/wavedrom/skins/narrow.js');
    copyFromPnpm('wavedrom', 'wavedrom.min.js', './out/dependencies/wavedrom/wavedrom.min.js');
    copyFromPnpm('vega', 'build/vega.min.js', './out/dependencies/vega/vega.min.js');
    copyFromPnpm('vega-lite', 'build/vega-lite.min.js', './out/dependencies/vega-lite/vega-lite.min.js');
    copyFromPnpm('vega-embed', 'build/vega-embed.min.js', './out/dependencies/vega-embed/vega-embed.min.js');
  }

  const copyDir = (src, dest) => {
    if (!fs.existsSync(src)) {
      console.warn(`Missing asset directory: ${src}`);
      return;
    }
    fs.mkdirSync(dest, { recursive: true });
    if (fs.cpSync) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
  };

  const copyDirFromPnpm = (packageName, sourceRelative, dest) => {
    const pkgDir = findPnpmPackageDir(packageName);
    if (!pkgDir) {
      console.warn(`Unable to resolve package directory for ${packageName}`);
      return;
    }
    copyDir(path.join(pkgDir, sourceRelative), dest);
  };

  // Monaco underlay edit mode has been removed; do not copy Monaco web assets.

  cb();
});
