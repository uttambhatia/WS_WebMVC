# Portable Theme App (Single Menu Example)

This is an independent minimal React 18 + Vite app extracted from the main shell idea.

It includes only:
- Theme selector with Classic, Dark, Slate, High Contrast
- One top menu item
- One left menu item
- Token-based theming at framework level

## Run

1. Open terminal in this folder:

   cd portable-theme-app

2. Install dependencies:

   npm install

3. Start dev server:

   npm run dev

4. Build:

   npm run build

## Where to change menu/theme mapping

- src/config/appShellConfig.js

## Theming model

- Framework tokens: src/styles/tokens.css
- App shell tokens per theme: src/app.css
- Root theme selector sets html[data-theme="..."]
- Components consume tokens; no runtime style rewriting is required.
