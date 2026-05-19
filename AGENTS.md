# Repository Guidelines

## Project Structure & Module Organization
- `src/index.html` is the browser entrypoint and loads `src/frontend.tsx`.
- `src/frontend.tsx` mounts React; `src/App.tsx` holds the main UI.
- `src/index.css` and `styles/globals.css` define Tailwind and theme styles.
- `src/image.png` is the bundled asset used by the app.
- `build.ts` produces the production bundle in `dist/`.
- Path aliases in `tsconfig.json` map `@/*` to `src/*`, so shared code should live under `src/components`, `src/lib`, or similar feature folders.

## Build, Test, and Development Commands
- `bun install` installs dependencies.
- `bun dev` starts the Bun server with hot reloading for local development.
- `bun start` runs the server in production mode after a build.
- `bun run build` cleans and rebuilds `dist/` through `build.ts`.
- No automated test script is configured yet. Use `bun dev` for interactive checks and run `bun run build` before opening a PR.

## Coding Style & Naming Conventions
- Use TypeScript and React with the existing strict compiler settings.
- Follow the current style: ES modules, double quotes, 2-space indentation, and concise component bodies.
- Use `PascalCase` for React components, `camelCase` for variables and functions, and descriptive file names that match the exported component or feature.
- Prefer Tailwind utility classes and the existing shadcn-style aliases over ad hoc CSS.

## Testing Guidelines
- There is no test framework or coverage gate in the repository today.
- If you add tests, keep them close to the code they cover and use a clear suffix such as `*.test.ts` or `*.spec.ts`.
- For now, verify routing, UI state, and API endpoints manually in the browser and confirm the production build succeeds.

## Commit & Pull Request Guidelines
- Git history is minimal and uses short, direct subjects such as `Initial commit` and `init`.
- Keep commit messages imperative and specific, for example `Add project card layout`.
- Pull requests should include a short summary, screenshots for UI changes, and any relevant validation notes or linked issues.

## Configuration Notes
- `bunfig.toml` enables `BUN_PUBLIC_*` environment variables for static serving.
- `vercel.json` points deployments at the generated `dist/` directory, so do not commit build artifacts.
