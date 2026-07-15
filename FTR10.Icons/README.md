# FTR10 Codex Icon Theme

A custom VS Code icon theme featuring the FTR10 Codex rabbit-inspired icon set with a green and dark color palette.


## Icons

| Icon | Description |
|------|-------------|
| ![Logo](./icons/logo.svg) | Main logo - Rabbit with code brackets |
| ![JS/TS](./icons/file_js.svg) | JavaScript/TypeScript files |
| ![JSON/YAML](./icons/file_json.svg) | JSON/YAML files |
| ![Markdown](./icons/file_md.svg) | Markdown files |
| ![HTML](./icons/file_html.svg) | HTML files |
| ![Code](./icons/file_code.svg) | Generic code files |
| ![Folder](./icons/folder.svg) | Folders (with burrow design) |
| ![Terminal](./icons/terminal.svg) | Terminal |
| ![Settings](./icons/settings.svg) | Settings |
| ![Error/Warning](./icons/error.svg) | Error/Warning |
| ![Success](./icons/success.svg) | Success (running rabbit) |

## Installation

### Option 1: Local Install (Development)
1. Copy the `FTR10.Codex` folder to `~/.vscode/extensions/ftr10.ftr10-codex-icon-theme-1.0.0/`
2. Restart VS Code
3. Go to **File > Preferences > File Icon Theme** (or **Code > Preferences > File Icon Theme** on macOS)
4. Select **FTR10 Codex**

### Option 2: Symlink
```bash
mkdir -p ~/.vscode/extensions
ln -s /home/ftr/.backups/FTR10.Codex ~/.vscode/extensions/ftr10.ftr10-codex-icon-theme-1.0.0
```
Then restart VS Code and select the theme.

### Option 3: Publish to Marketplace
```bash
npm install -g vsce
cd /home/ftr/.backups/FTR10.Codex
vsce package
# Installs the .vsix file directly
code --install-extension ftr10-codex-icon-theme-1.0.0.vsix
```

## Color Palette

- **Primary Green**: `#4ADE80`
- **Dark Green**: `#22C55E`
- **Gray Outline**: `#4B5563`
- **Dark Fill**: `#1F2937`
- **Background**: `#111827`

## File Structure

```
FTR10.Codex/
├── icons/
│   ├── ftr10codex_logo.svg
│   ├── file_js.svg
│   ├── file_json.svg
│   ├── file_md.svg
│   ├── file_html.svg
│   ├── file_code.svg
│   ├── folder.svg
│   ├── terminal.svg
│   ├── settings.svg
│   ├── error.svg
│   ├── warning.svg
│   └── success.svg
├── icon-theme.json
├── package.json
└── README.md
```

## License

MIT
