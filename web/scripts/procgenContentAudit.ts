import { runProcgenContentAudit } from '../src/tools/procgenContentAudit'

const { text, exitCode } = runProcgenContentAudit()
console.log(text)
process.exit(exitCode)
