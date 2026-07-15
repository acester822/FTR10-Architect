/**
 * Copy generated assets from crossnote/out/ into crossnote/:
 * - crossnote/out/dependencies/ → crossnote/dependencies/
 * - crossnote/out/webview/      → crossnote/webview/
 *
 * NOTE: The crossnote runtime build directory is set to crossnote/out/ in preview-provider.ts,
 * so compiled CSS (out/styles/), webview JS, and dependencies are all resolved from there.
 * The crossnote/styles/ directory contains only .less sources and vendor CSS — no compiled output.
 */
const gulp = require('gulp');
const fs = require('fs');

gulp.task('clean-out', (cb) => {
  // Delete ./out folder
  if (fs.existsSync('./out')) {
    fs.rmSync('./out', { recursive: true });
  }
  cb();
});

gulp.task('copy-files', (cb) => {
  fs.mkdirSync('./crossnote', { recursive: true });

  // dependencies and webview are pure compiled outputs — safe to wipe and replace.
  for (const dir of ['./crossnote/dependencies', './crossnote/webview']) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }

  // Copy compiled assets
  gulp
    .src('./crossnote/out/dependencies/**/*')
    .pipe(gulp.dest('./crossnote/dependencies/'));
  gulp
    .src('./crossnote/out/webview/**/*')
    .pipe(gulp.dest('./crossnote/webview/'));

  console.log('Copy files done.');

  cb();
});
