const mongoose = require('mongoose');

// ✅ VISTA ADMINISTRADOR: Para inyectar CSS/JS globalmente
const SystemConfigSchema = new mongoose.Schema({
    key: { type: String, default: 'global_settings' },
    customCSS: { type: String, default: '' },
    customJS: { type: String, default: '' },
    maintenanceMode: { type: Boolean, default: false },
    updatedBy: { type: String }
});

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);