// Fails if a library component uses a class without the `dx:` prefix.
// The package stylesheet (src/lib/styles.css) only generates `dx:` classes, so an unprefixed
// class renders unstyled in every host app. The demo cannot catch this: its own Tailwind
// generates the unprefixed class, so it still looks right there.
import { readFileSync } from 'node:fs'

const FILES = [
  'src/DxHostOverlay.tsx',
  'src/TokenCalibrationUnit.tsx',
  'src/DxGridVoice.tsx',
  'src/DxInspector.tsx',
]

// Custom component classes (.dx-*) and already-prefixed utilities are fine.
const ok = (token) => !token || token.startsWith('dx:') || token.startsWith('dx-')

const classStrings = (source) => {
  const found = []
  for (const m of source.matchAll(/className="([^"]*)"/g)) found.push(m[1])
  for (const m of source.matchAll(/const \w+ClassName =\s*'([^']*)'/g)) found.push(m[1])
  for (const m of source.matchAll(/className=\{`([^`]*)`/g)) {
    const body = m[1]
    found.push(body.replace(/\$\{[^}]*\}/g, ' ')) // static parts
    for (const q of body.matchAll(/\$\{[^}]*\}/g)) {
      for (const s of q[0].matchAll(/'([^']*)'/g)) found.push(s[1]) // strings inside ${}
    }
  }
  return found
}

let problems = 0
for (const file of FILES) {
  for (const list of classStrings(readFileSync(file, 'utf8'))) {
    for (const token of list.split(/\s+/)) {
      if (!ok(token)) {
        console.error(`${file}: unprefixed class "${token}" (write dx:${token})`)
        problems += 1
      }
    }
  }
}

if (problems > 0) {
  console.error(`\n${problems} unprefixed class(es). Library components must use dx: utilities.`)
  process.exit(1)
}
console.log(`dx: prefix check passed (${FILES.length} files).`)
