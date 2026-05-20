const fs = require('fs');
const https = require('https');
const { AUTOPISTAS_ITALIA, CONFIGURACION_RUTA } = require('./autopistasItalia.js');

const URL_CSV = 'https://carburanti.mise.gov.it/ospzApi/prezzi/csv';

function descargarYConvertir(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const lineas = data.split('\n');
                // El archivo usa | como separador
                const cabeceras = lineas[0].split('|').map(h => h.trim());
                
                const resultado = lineas.slice(1).map(linea => {
                    const valores = linea.split('|');
                    let obj = {};
                    cabeceras.forEach((h, i) => obj[h] = valores[i]);
                    return obj;
                }).filter(o => o.Latitudine && o.Longitudine);
                
                resolve(resultado);
            });
        }).on('error', reject);
    });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function procesar() {
    console.log("Descargando y filtrando gasolineras...");
    const todas = await descargarYConvertir(URL_CSV);
    
    const filtradas = todas.filter(gas => {
        // Aseguramos que los valores sean texto antes de reemplazar
        const latStr = gas.Latitudine || "";
        const lonStr = gas.Longitudine || "";
        
        const gLat = parseFloat(latStr.replace(',', '.'));
        const gLon = parseFloat(lonStr.replace(',', '.'));
        
        if (isNaN(gLat) || isNaN(gLon)) return false;
        
        return CONFIGURACION_RUTA.rutaPuntos.some(punto => 
            calcularDistancia(gLat, gLon, punto.lat, punto.lon) <= CONFIGURACION_RUTA.radioKM
        );
    });

    fs.writeFileSync('gasolineras.json', JSON.stringify(filtradas, null, 2));
    console.log(`Proceso completado. Gasolineras en ruta: ${filtradas.length}`);
}

procesar();
