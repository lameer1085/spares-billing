// Splits "name: must not be blank; phone: Invalid phone number" into per-field messages.
// Messages that name no field are matched by keyword, or fall into `general`.
export function splitServerMessage<F extends string>(
  msg: string,
  fields: readonly F[],
  keywords: [RegExp, F][],
): { errors: Partial<Record<F, string>>; general: string[] } {
  const errors: Partial<Record<F, string>> = {}
  const general: string[] = []
  for (const raw of msg.split(';')) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\w+):\s*(.*)$/.exec(part)
    if (m && (fields as readonly string[]).includes(m[1])) {
      errors[m[1] as F] = m[2]
      continue
    }
    const hit = keywords.find(([re]) => re.test(part))
    if (hit) errors[hit[1]] = part
    else general.push(part)
  }
  return { errors, general }
}