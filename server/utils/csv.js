// server/utils/csv.js
// Small RFC 4180 CSV reader/writer (quoted fields, escaped quotes, CRLF, embedded newlines).

function parseCsv(text) {
  const input = String(text || '').replace(/^﻿/, ''); // strip BOM (Excel adds one)
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  // Drop completely blank lines
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Guard against spreadsheet formula injection when the CSV is opened in Excel/Sheets
function safeCell(value) {
  const s = value == null ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(safeCell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { parseCsv, toCsv };
