const fs = require('fs');
const https = require('https');
const { CONFIGURACION_RUTA } = require('./autopistasItalia.js');

const URL_IMPIANTI = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const URL_PRECIOS = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

function descargarCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.setEncoding('latin1'); // Para acentos italianos
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let lineas = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                
                // Si la primera línea es la fecha de extracción, la saltamos para buscar la cabecera real
                if (lineas[0] && lineas[0].includes('Estrazione del')) {
                    lineas = lineas.slice(1);
                }

                if (lineas.length === 0) {
                    resolve([]);
                    return;
                }

                const cabeceras = lineas[0].split('|').map(h => h.trim());
                
                const resultado = lineas.slice(1).map(linea => {
                    const valores = linea.split('|');
                    let obj = {};
                    cabeceras.forEach((h, i) => {
                        obj[h] = valores[i] ? valores[i].trim() : "";
                    });
                    return obj;
                });
                resolve(resultado);
            });
        }).on('error', reject);
    });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const gLat = parseFloat(lat1.replace(',', '.'));
    const gLon = parseFloat(lon1.replace(',', '.'));
    if (isNaN(gLat) || isNaN(gLon)) return 99999; // Evita errores si la coordenada está mal
    
    const dLat = (lat2 - gLat) * Math.PI / 180;
    const dLon = (lon2 - gLon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(gLat*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function procesar() {
    console.log("Descargando archivos reales del MIMIT...");
    const impianti = await descargarCSV(URL_IMPIANTI);
    const precios = await descargarCSV(URL_PRECIOS);

    console.log(`Datos cargados -> Instalaciones: ${impianti.length}, Precios: ${precios.length}`);

    // 1. Intentamos filtrar por la ruta que definiste
    let filtradas = impianti.filter(imp => {
        if (!imp.Latitudine || !imp.Longitudine) return false;
        
        return CONFIGURACION_RUTA.rutaPuntos.some(p => 
            calcularDistancia(imp.Latitudine, imp.Longitudine, p.lat, p.lon) <= CONFIGURACION_RUTA.radioKM
        );
    });

    // 2. MODO SEGURIDAD: Si el filtro de ruta es muy estricto y da 0, 
    // agarramos las primeras 10 de Italia para demostrar que la descarga funciona.
    if (filtradas.length === 0) {
        console.log("Aviso: Tu ruta no cruzó con ninguna gasolinera. Guardando muestra de seguridad...");
        filtradas = impianti.filter(imp => imp.Latitudine && imp.Longitudine).slice(0, 10);
    }

    // 3. Cruzamos con los precios
    const resultadoFinal = filtradas.map(imp => {
        const infoPrecio = precios.find(p => p.idImpianto === imp.idImpianto);
        return {
            idImpianto: imp.idImpianto,
            bandiera: imp.Bandiera,
            nomeImpianto: imp.TemplateName || imp['Nome Impianto'] || imp.nomeImpianto,
            indirizzo: imp.Indirizzo,
            comune: imp.Comune,
            latitud: imp.Latitudine,
            longitud: imp.Longitudine,
            precio: infoPrecio ? infoPrecio.prezzo : "N/A",
            tipoCarburante: infoPrecio ? infoPrecio.descCarburante : "N/A"
        };
    });

    fs.writeFileSync('gasolineras.json', JSON.stringify(resultadoFinal, null, 2));
    console.log(`¡Proceso completado! Archivo 'gasolineras.json' guardado con ${resultadoFinal.length} registros.`);
}

procesar();
