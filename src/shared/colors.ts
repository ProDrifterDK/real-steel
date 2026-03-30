// Side-effect module: ensures chalk enables color support.
// Must be imported before any chalk-using module (like marked-terminal).
// ESM evaluates this first since it has no dependencies.
if (process.stdout.isTTY) {
  process.env.FORCE_COLOR = "3";
}
