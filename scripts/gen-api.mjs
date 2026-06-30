// Generate zod schemas from the SINGLE source-of-truth swagger (docs/swagger/install-v1.yaml).
// The swagger is consumed verbatim and is NEVER modified. All fixes live HERE, in the GENERATED
// output, never in the swagger.
//
// The upstream BFF response does not perfectly match the swagger, so STRICT zod parsing throws on
// benign drift. We post-process the generated schemas into a LOOSE form that only catches genuine
// basic-type mismatches (e.g. a number where a string is declared) and tolerates everything else:
//
//   0. invalid `(?i)` inline-flag regex   not valid JS regex; the value is otherwise unconstrained.
//   1. format / range refinements dropped .datetime() .regex() .email() .url() .uuid() .min() .max()
//      .int()                             e.g. "2026-05-06T04:36:31.661958" (no Z) must pass.
//   2. enums -> z.string()                a new/stale BFF enum value is still a valid string.
//   3. `z.object({})` -> record(unknown)  the empty object infers as `{}` (un-indexable); a record
//                                          is indexable, fixing `x.requested_by.user_id` access.
//   4. every primitive/array/record field nullable   null wire values pass (idc_host: null,
//                                          idc_source_ips: null, nlb_index: null, ...).
//   5. every object partial               missing fields pass ("field existence ignored"). Objects
//                                          are NOT themselves made nullable: a top-level
//                                          `schemas.X.parse(...)` result stays `T` (not `T | null`),
//                                          which is what consumers index into.
//   6. passthrough (already emitted)       extra wire fields ignored.
//
// Net: only `string vs number`-class mismatches fail; null / datetime format / missing / extra
// fields all pass. Inferred types loosen to `T | null` to match the runtime contract.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'lib/generated/install-v1.ts';
const TEMPLATE = 'node_modules/openapi-zod-client/src/templates/schemas-only.hbs';

execSync(
  `openapi-zod-client docs/swagger/install-v1.yaml -o ${OUT} -t ${TEMPLATE} --export-schemas`,
  { stdio: 'inherit' },
);

// Insert `.nullable()` after each balanced `z.<ctor>(...)` call. A char scan (not regex) so it is
// correct for nesting like `z.array(z.record(...))` that a paren-counting regex cannot match.
const appendNullable = (s, ctor) => {
  const needle = `z.${ctor}(`;
  const cuts = [];
  for (let i = s.indexOf(needle); i !== -1; i = s.indexOf(needle, i + 1)) {
    let depth = 0;
    for (let j = i + needle.length - 1; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')' && --depth === 0) {
        cuts.push(j + 1);
        break;
      }
    }
  }
  for (const pos of cuts.sort((a, b) => b - a)) s = `${s.slice(0, pos)}.nullable()${s.slice(pos)}`;
  return s;
};

let src = readFileSync(OUT, 'utf8')
  // 0. invalid `(?i)` inline-flag regex (not valid JS); enum already constrains the value.
  .replace(/\s*\.regex\(\/\(\?i\)[^/]*\/\)/g, '')
  // 1. drop format/range refinements — the underlying basic type is unchanged.
  .replace(/\.datetime\([^)]*\)/g, '')
  .replace(/\.int\(\)/g, '')
  .replace(/\.regex\([^)]*\)/g, '')
  .replace(/\.(email|url|uuid)\(\)/g, '')
  .replace(/\.(min|max)\(\d+\)/g, '')
  // 2. enums -> plain string (unknown BFF enum values are still strings).
  .replace(/z\.enum\(\[[^\]]*\]\)/g, 'z.string()')
  // 3. free-form `z.object({})` (infers `{}`) -> indexable record. Must run before step 5 strips
  //    the `.partial()` this pattern keys on.
  .replace(/z\.object\(\{\}\)\.partial\(\)\.passthrough\(\)/g, 'Loose')
  // 4. primitives -> nullable, paren-free aliases (so step-6 array/record scans stay simple).
  .replace(/z\.string\(\)/g, 'Str')
  .replace(/z\.number\(\)/g, 'Num')
  .replace(/z\.boolean\(\)/g, 'Bool')
  // 5. every object: drop existing `.partial()`, then re-apply partial uniformly (all keys
  //    optional). After step 3 the only `.passthrough();` left are object-const ends. Objects are
  //    deliberately NOT made nullable here — only their fields are (steps 4 + 6).
  .replace(/\s*\.partial\(\)/g, '')
  .replace(/\.passthrough\(\);/g, '.partial().passthrough();');

// 6. arrays + records nullable (balanced-paren aware).
src = appendNullable(src, 'array');
src = appendNullable(src, 'record');

// 7. define the loose aliases used above.
src = src.replace(
  'import { z } from "zod";',
  [
    'import { z } from "zod";',
    'const Str = z.string().nullable();',
    'const Num = z.number().nullable();',
    'const Bool = z.boolean().nullable();',
    'const Loose = z.record(z.unknown()).nullable();',
  ].join('\n'),
);

writeFileSync(OUT, src);
console.log('gen:api done (loose schemas: basic-type checks only; null / format / missing / extra tolerated)');
