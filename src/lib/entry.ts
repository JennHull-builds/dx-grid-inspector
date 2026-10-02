// Library build entry. It pulls the stylesheet into the build so Vite emits
// dist-lib/style.css. The public types come from ./index.ts, which has no CSS import,
// so the published .d.ts never points at a stylesheet that is not there.
import './styles.css'
export * from './index'
