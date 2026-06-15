// Usage: node scripts/import-demo-data.js path/to/file.csv
//
// Handles both:
//   - Standard CSV exports
//   - Supabase SQL snippet exports (INSERT INTO ... VALUES ...)
//
// Required env vars:
//   SUPABASE_URL  — your demo project URL
//   SUPABASE_KEY  — your demo project anon key

const { createClient } = require('@supabase/supabase-js')
const { readFileSync }  = require('fs')
const { resolve }       = require('path')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const BATCH_SIZE   = 50

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Set SUPABASE_URL and SUPABASE_KEY before running.')
  process.exit(1)
}

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/import-demo-data.js path/to/file.csv')
  process.exit(1)
}

// ── SQL INSERT parser ─────────────────────────────────────────────────────────
// Parses: INSERT INTO table (col1, col2) VALUES ('val1', 'val2');

function parseSQLValue(raw) {
  if (raw === 'NULL') return null
  // Strip surrounding single quotes and unescape '' → '
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'")
  }
  // Numeric or unquoted value
  return raw
}

function parseSQLInserts(text) {
  const records = []
  let columns   = null

  // The file is a 1-column CSV where each cell contains a SQL INSERT statement.
  // Strip surrounding double quotes and any trailing CRLF from each line.
  const insertRe = /INSERT INTO \w+ \(([^)]+)\) VALUES \((.+)\);?\s*$/

  for (const rawLine of text.split('\n')) {
    // Unwrap CSV quoting: strip leading/trailing whitespace, quotes, and CR
    const line = rawLine.replace(/\r$/, '').trim().replace(/^"|"$/g, '').trim()
    if (!line || line === '?column?') continue

    const m = line.match(insertRe)
    if (!m) continue

    // Parse column names once
    if (!columns) {
      columns = m[1].split(',').map(c => c.trim())
    }

    // Parse values — split on commas that are NOT inside single quotes
    const valStr = m[2]
    const values = []
    let cur      = ''
    let inStr    = false

    for (let i = 0; i < valStr.length; i++) {
      const ch   = valStr[i]
      const next = valStr[i + 1]

      if (inStr) {
        if (ch === "'" && next === "'") { cur += "'"; i++ }  // escaped quote
        else if (ch === "'")             { inStr = false; cur += ch }
        else                             { cur += ch }
      } else {
        if (ch === "'")       { inStr = true; cur += ch }
        else if (ch === ',')  { values.push(parseSQLValue(cur.trim())); cur = '' }
        else                  { cur += ch }
      }
    }
    if (cur.trim()) values.push(parseSQLValue(cur.trim()))

    const obj = {}
    columns.forEach((col, i) => { obj[col] = values[i] ?? null })
    records.push(obj)
  }

  return records
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(raw) {
  const rows = []
  let field   = ''
  let inQuote = false
  let fields  = []

  for (let i = 0; i < raw.length; i++) {
    const ch   = raw[i]
    const next = raw[i + 1]

    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"')             { inQuote = false }
      else                             { field  += ch }
    } else {
      if      (ch === '"')  { inQuote = true }
      else if (ch === ',')  { fields.push(field); field = '' }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { fields.push(field); rows.push(fields); fields = []; field = '' }
      else                  { field += ch }
    }
  }
  if (field || fields.length) { fields.push(field); rows.push(fields) }

  if (rows.length < 2) return []
  const headers  = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1).filter(r => r.some(f => f.trim()))

  return dataRows.map(row => {
    const obj = {}
    headers.forEach((key, i) => {
      const val = (row[i] ?? '').trim()
      obj[key] = val === '' ? null : val
    })
    return obj
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const raw      = readFileSync(resolve(filePath), 'utf-8')

  // Detect format by checking whether the first non-empty line is a SQL INSERT
  const firstLine = raw.split('\n').find(l => l.trim())?.trim() ?? ''
  const isSQLDump = firstLine === '?column?' || firstLine.startsWith('INSERT INTO')

  let records
  if (isSQLDump) {
    console.log('Detected format: Supabase SQL snippet')
    records = parseSQLInserts(raw)
  } else {
    console.log('Detected format: CSV')
    records = parseCSV(raw)
  }

  if (records.length === 0) {
    console.error('No records found — check the file format.')
    process.exit(1)
  }

  console.log(`Rows to import: ${records.length}\n`)

  let inserted = 0
  let failed   = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('items')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message)
      failed += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`  ${inserted} / ${records.length} rows imported\r`)
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${failed} failed.`)
}

main().catch(err => { console.error(err); process.exit(1) })
