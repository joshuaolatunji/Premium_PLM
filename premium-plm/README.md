# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

---

## Deployment

Not yet deployed. Before the first deploy, work through this list.

### 1. SPA rewrite (required)

The app uses client-side routing, so a direct browser request for a path like
`/set-password?token=...` goes to the static host, which will 404 instead of
serving `index.html`. This is not optional for Premium PLM: the new-user
invitation email contains a link to `/set-password`, and that link is a cold
load, not an in-app navigation.

`vite dev` and `vite preview` both fall back to `index.html`, so this will pass
locally and fail in production. Add the rewrite for the host you pick:

| Host | File | Contents |
| --- | --- | --- |
| Vercel | `vercel.json` | `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` |
| Netlify | `public/_redirects` | `/* /index.html 200` |
| Firebase | `firebase.json` | `{"rewrites":[{"source":"**","destination":"/index.html"}]}` |
| Azure Static Web Apps | `staticwebapp.config.json` | `{"routes":[{"route":"/*","redirect":"/index.html"}]}` |
| nginx / IIS | host config | rewrite unmatched requests to `/index.html` |

Then verify: open `/set-password?token=x` in a **private window** on the deployed
origin and confirm the page renders, not a 404.

### 2. Environment

- `VITE_API_BASE_URL` — required. `src/lib/config/env.ts` throws at module load
  if it is unset, so the app renders a blank screen rather than degrading. Set it
  in the host's build environment; do not rely on a committed `.env`.
- `.env` is gitignored. `.env.example` is the committed reference.

### 3. Before the invite flow goes live

- `PLMAdmin/create-user` returns a **relative** setup link
  (`/set-password?token=...`). Confirm the backend prefixes the frontend origin
  before emailing it, otherwise the link is unclickable.
- The setup token is an opaque SHA-256 digest and carries no email, so
  `/set-password` also asks the user to type their address. That is a property
  of the current API, not a choice in the UI.
- `PLMAuth/autoreset-password` accepts an email and a new password with **no
  verification code, token, or current password**. The "Forgot password?" button
  is therefore disabled. Do not enable it until the backend verifies the
  requester owns the mailbox.
- The login response carries no "must change password" flag, even though
  `autoreset-password` and `change-temporary-password` imply the state exists.
  `/change-temporary-password` is reachable but never auto-triggered. Ask the
  backend to add the flag.
- `endpoints.initiatives.list` (`/api/product-initiatives`) is not part of the
  verified API surface. Confirm it before wiring anything to it.
