/**
 * Serialización a CSV legible por Excel (informes ejecutivos del Estado).
 *
 * - Antepone BOM UTF-8 para que Excel muestre bien las tildes y la ñ.
 * - Escapa comillas y envuelve en comillas los campos con separadores/saltos.
 * - Usa ';' como separador: Excel en configuración regional es-PE lo abre en
 *   columnas sin pasos extra.
 */
const SEP = ';';

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(SEP) || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {string[]} headers - Encabezados de columna.
 * @param {Array<Array<any>>} rows - Filas (cada una un array alineado con headers).
 * @returns {string} CSV con BOM listo para descargar.
 */
function toCSV(headers, rows) {
  const lines = [headers.map(escapeCell).join(SEP)];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(SEP));
  }
  return '﻿' + lines.join('\r\n');
}

/** Escribe la respuesta HTTP como archivo CSV descargable. */
function sendCSV(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCSV(headers, rows));
}

module.exports = { toCSV, sendCSV };
