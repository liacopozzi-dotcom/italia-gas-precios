const fs = require('fs');
const https = require('https');
const { AUTOPISTAS_ITALIA, CONFIGURACION_RUTA } = require('./autopistasItalia.js');

const URL_CSV = 'https://carburanti.mise.gov.it/ospzApi/prezzi/csv';

function descargarYConvertir(url) {
    return new Promise((resolve, reject) => {
        const opciones = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        https.get(url, opciones, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                // Si la respuesta es un error 404 o 403, avisamos
                if (res.statusCode !== 200) {
                    reject(new Error(`Error del servidor: ${res.statusCode}`));
                    return;
                }
                
                const lineas = data.split('\n');
                if (lineas.length < 2) {
                    reject(new Error("El archivo descargado está vacío o no es un CSV válido"));
                    return;
                }

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
