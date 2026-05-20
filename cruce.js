const fs = require('fs');
const https = require('https');
const config = require('./autopistasItalia.js');

// URL oficial del Ministerio de Energía italiano
const URL_CSV = 'https://carburanti.mise.gov.it/ospzApi/prezzi/csv';

function descargarYConvertir(url, destino) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                // Conversión simple de CSV a Array de Objetos
                const lineas = data.split('\n');
                const cabeceras = lineas[0].split(';');
                const resultado = lineas.slice(1).map(linea => {
                    const valores = linea.split(';');
                    let obj = {};
                    cabeceras.forEach((h, i) => obj[h.trim()] = valores[i]);
                    return obj;
                }).filter(o => o.lat && o.lon); // Filtramos líneas vacías
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
    console.log("Iniciando descarga y filtrado...");
    
    const todasLasGasolineras = await descargarYConvertir(URL_CSV, 'temp.csv');
    
    const filtradas = todasLasGasolineras.filter(gas => {
        // Convertimos lat/lon a números (porque vienen como texto del CSV)
        const gLat = parseFloat(gas.Latitudine.replace(',', '.'));
        const gLon = parseFloat(gas.Longitudine.replace(',', '.'));
        
        // Comprobar si está en el rango de cualquiera de tus puntos
        return config.rutaPuntos.some(punto => 
            calcularDistancia(gLat, gLon, punto.lat, punto.lon) <= config.radioKM
        );
    });

    fs.writeFileSync('gasolineras.json', JSON.stringify(filtradas, null, 2));
    console.log(`Proceso completado. Gasolineras en rango: ${filtradas.length}`);
}

procesar();
