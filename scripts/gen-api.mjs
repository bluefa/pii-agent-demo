// Generate zod schemas from the SINGLE source-of-truth swagger (docs/swagger/install-v1.yaml).
// The swagger is consumed verbatim and is NEVER modified. This script only sanitizes the
// GENERATED output for one codegen incompatibility:
//
//   `cloud_type` carries a Java/PCRE-style `pattern: (?i)^(aws|...)$`. `(?i)` is an inline
//   flag that is NOT valid ECMA/JS regex. openapi-zod-client emits `z.enum([...]).regex(/(?i).../)`
//   which (a) calls .regex() on a ZodEnum (no such method) and (b) is a JS syntax error.
//   The enum already constrains the value, so we drop the generated `.regex(...)` call.
//
// Fix lives here (generated output), not in the swagger.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'lib/generated/install-v1.ts';
const TEMPLATE = 'node_modules/openapi-zod-client/src/templates/schemas-only.hbs';

execSync(
  `openapi-zod-client docs/swagger/install-v1.yaml -o ${OUT} -t ${TEMPLATE} --export-schemas`,
  { stdio: 'inherit' },
);

let src = readFileSync(OUT, 'utf8');
const before = src;
// Strip `.regex(/(?i)...$/)` (invalid JS regex from the `(?i)` inline flag). Non-greedy to the
// closing `/)`; the regex body contains no `/`, so this is unambiguous.
src = src.replace(/\s*\.regex\(\/\(\?i\)[^/]*\/\)/g, '');
writeFileSync(OUT, src);

const removed = (before.match(/\.regex\(\/\(\?i\)/g) || []).length;
console.log(`gen:api done${removed ? ` (sanitized ${removed} invalid (?i) regex call(s))` : ''}`);
