// deno std
export { concat as concatBytes } from "https://deno.land/std@0.175.0/bytes/mod.ts";
export { encode as btoa } from "https://deno.land/std@0.175.0/encoding/base64.ts";
export * as colors from "https://deno.land/std@0.175.0/fmt/colors.ts";
export { ensureDir } from "https://deno.land/std@0.175.0/fs/ensure_dir.ts";
export { serve, serveTls } from "https://deno.land/std@0.175.0/http/server.ts";
export * as path from "https://deno.land/std@0.175.0/path/mod.ts";

// third-party
// @deno-types="https://deno.land/x/esbuild@v0.17.10/mod.d.ts"
export * as esbuild from "https://deno.land/x/esbuild@v0.17.10/mod.js";
export * from "https://deno.land/x/aleph_compiler@0.8.5/mod.ts";
export * from "https://deno.land/x/aleph_compiler@0.8.5/types.ts";
export { HTMLRewriter } from "https://deno.land/x/lol_html@0.0.6/mod.ts";
export { JSONC } from "https://deno.land/x/jsonc_parser@v0.0.1/src/jsonc.ts";

// npm
export { default as mitt, type Emitter } from "https://esm.sh/v110/mitt@3.0.0";

// init lol-html wasm
import initLolHtml from "https://deno.land/x/lol_html@0.0.6/mod.ts";
import getLolHtmlWasmData from "https://deno.land/x/lol_html@0.0.6/wasm.js";
await initLolHtml(getLolHtmlWasmData());
