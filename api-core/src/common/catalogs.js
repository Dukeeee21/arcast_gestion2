/**
 * Catálogos controlados (fuente ÚNICA de verdad) para el estándar institucional.
 *
 * En software del Estado los metadatos clasificatorios NO pueden ser texto libre:
 * deben provenir de una lista cerrada y auditable para que los filtros, los
 * reportes y las estadísticas territoriales sean consistentes en el tiempo.
 *
 * Estas constantes las consumen:
 *   - Los modelos (validación con `enum`).
 *   - El endpoint GET /api/system/catalogs (para que la UI pinte los checkboxes
 *     y selects sin hardcodear valores en el frontend).
 *   - Los seeds y migraciones.
 *
 * Si mañana el Ministerio agrega una lengua o un fondo, se cambia SOLO aquí.
 */

// Regiones naturales del Perú — usadas para el filtro de catálogo (mockup "REGIÓN").
const REGIONES_NATURALES = ['Costa', 'Sierra', 'Selva'];

// Departamentos (nivel UBIGEO 1) — usados para el dato demográfico del usuario
// y para el mapa de impacto territorial de la Vista Jefe.
const DEPARTAMENTOS = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca',
  'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín',
  'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua',
  'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
];

// Lenguas: castellano + principales lenguas originarias reconocidas.
const LENGUAS = [
  'Español', 'Quechua', 'Aymara', 'Asháninka', 'Shipibo-Konibo', 'Awajún', 'Otra',
];

// Fondos estatales bajo los que se financia o resguarda el material.
const FONDOS_ESTATALES = [
  'Fondo Histórico Nacional',
  'Fondo Cultural Regional',
  'Fondo Institucional',
  'Fondo de Preservación',
  'Estímulos Económicos (DAFO)',
  'No Aplica',
];

// Ciclo de vida editorial (flujo de aprobación técnico → supervisor).
const ESTADOS_PUBLICACION = ['Borrador', 'Pendiente', 'Aprobado', 'Rechazado', 'Oculto'];

// Roles del sistema (3): separan QUIÉN consume, QUIÉN sube y QUIÉN aprueba/audita.
//   investigador/usuario -> 'user'    (consume y anota)
//   técnico              -> 'tecnico' (cataloga y envía a revisión; NO publica)
//   supervisor           -> 'admin'   (aprueba, gestiona, audita y ve la analítica/mapa territorial)
const ROLES = ['user', 'tecnico', 'admin'];

module.exports = {
  REGIONES_NATURALES,
  DEPARTAMENTOS,
  LENGUAS,
  FONDOS_ESTATALES,
  ESTADOS_PUBLICACION,
  ROLES,
};
