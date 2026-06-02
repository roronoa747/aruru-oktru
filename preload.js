const { contextBridge, ipcRenderer } = require('electron');
const XLSX = require('xlsx');

// Parse workbook to data object
function parseWorkbook(wb) {
  function getRows(name) {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
  }
  const oktru     = getRows('OKTRU').map(r=>({code:r[0],parent:r[1],nameRu:r[2],nameKk:r[3]})).filter(r=>r.code);
  const countries = getRows('Страна происхождения').map(r=>({code:r[0],nameRu:r[2],nameKk:r[3]})).filter(r=>r.code);
  const units     = getRows('Единица измерения').map(r=>({code:r[0],nameRu:r[2],nameKk:r[3]})).filter(r=>r.code);
  const tnved     = getRows('ТНВЭД ЕАЭС').map(r=>({code:r[0],nameRu:r[2]})).filter(r=>r.code);
  return { oktru, countries, units, tnved };
}

contextBridge.exposeInMainWorld('electronAPI', {
  parseXlsx: (arrayBuffer) => {
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    return parseWorkbook(wb);
  },
  saveDataJson: (jsonString) => ipcRenderer.invoke('save-data-json', jsonString),
  loadUserData:  ()          => ipcRenderer.invoke('load-user-data'),
});
