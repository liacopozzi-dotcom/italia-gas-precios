const fs = require('fs');
const https = require('https');
const { CONFIGURACION_RUTA } = require('./autopistasItalia.js');

const URL_IMPIANTI = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const URL_PRECIOS = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

function descargarCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.setEncoding('latin1'); // Importante para caracteres italianos
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const lineas = data.split('\n');
                const cabeceras = lineas[0].split('|').map(h => h.trim());
                const resultado = lineas.slice(1).map(linea => {
                    const valores = linea.split('|');
                    let obj = {};
                    cabeceras.forEach((h, i) => obj[h] = valores[i]);
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
    const dLat = (lat2 - gLat) * Math.PI / 180;
    const dLon = (lon2 - gLon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(gLat*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function procesar() {
    console.log("Descargando archivos...");
    const impianti = await descargarCSV(URL_IMPIANTI);
    const precios = await descargarCSV(URL_PRECIOS);

    console.log(`Procesando ${impianti.length} instalaciones...`);

    const resultadoFinal = impianti.filter(imp => {
        if (!imp.Latitudine || !imp.Longitudine) return false;
        
        // Filtro de distancia
        const enRuta = CONFIGURACION_RUTA.rutaPuntos.some(p => 
            calcularDistancia(imp.Latitudine, imp.Longitudine, p.lat, p.lon) <= CONFIGURACION_RUTA.radioKM
        );
        
        return enRuta;
    }).map(imp => {
        // Unimos el precio buscando por idImpianto
        const infoPrecio = precios.find(p => p.idImpianto === imp.idImpianto);
        return {
            ...imp,
            precio: infoPrecio ? infoPrecio.prezzo : "N/A",
            tipoCarburante: infoPrecio ? infoPrecio.descCarburante : "N/A"
        };
    });

    fs.writeFileSync('gasolineras.json', JSON.stringify(resultadoFinal, null, 2));
    console.log(`¡Éxito! Guardadas ${resultadoFinal.length} gasolineras con precios.`);
}

procesar();
