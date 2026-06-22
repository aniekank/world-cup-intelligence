// Empty module — Vitest aliases `server-only`/`client-only` here so server/client
// modules can be unit-tested in a plain Node environment (those packages throw
// when resolved outside Next's RSC/browser pipelines). No-op by design.
export {};
