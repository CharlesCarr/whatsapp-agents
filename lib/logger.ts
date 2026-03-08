// Thin structured JSON logger — outputs newline-delimited JSON to stdout/stderr.
// Compatible with Vercel log drain and any log aggregator (Datadog, Logtail, etc.).
export const log = {
  info: (msg: string, ctx?: object) =>
    console.log(JSON.stringify({ level: "info", msg, ...ctx, ts: new Date().toISOString() })),
  warn: (msg: string, ctx?: object) =>
    console.warn(JSON.stringify({ level: "warn", msg, ...ctx, ts: new Date().toISOString() })),
  error: (msg: string, ctx?: object) =>
    console.error(JSON.stringify({ level: "error", msg, ...ctx, ts: new Date().toISOString() })),
};
