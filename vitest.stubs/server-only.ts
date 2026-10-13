// Stub for the `server-only` marker package, which has no runtime resolution
// under Vitest. The real package only exists to fail a client-side import at
// build time; tests that import a server module need it to resolve to nothing.
export {};
