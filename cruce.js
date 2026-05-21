const fs = require('fs');
const https = require('https');
const { CONFIGURACION_RUTA } = require('./autopistasItalia.js');

const URL_IMPIANTI = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const URL_PRECIOS = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

function descargarCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.setEncoding('latin1'); 
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let lineas = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                
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
    if (isNaN(gLat) || isNaN(gLon)) return 99999; 
    
    const dLat = (lat2 - gLat) * Math.PI / 180;
    const dLon = (lon2 - gLon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(gLat*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function procesar() {
    console.log("Descargando y filtrando mejores precios 'Self'...");
    const impianti = await descargarCSV(URL_IMPIANTI);
    const precios = await descargarCSV(URL_PRECIOS);

    // Filtramos instalaciones por tu ruta configurada
    let filtradas = impianti.filter(imp => {
        if (!imp.Latitudine || !imp.Longitudine) return false;
        
        return CONFIGURACION_RUTA.rutaPuntos.some(p => 
            calcularDistancia(imp.Latitudine, imp.Longitudine, p.lat, p.lon) <= CONFIGURACION_RUTA.radioKM
        );
    });

    // MODO SEGURIDAD: Muestra temporal si la ruta da 0
    if (filtradas.length === 0) {
        console.log("Aviso: Tu ruta no cruzó con ninguna gasolinera. Guardando muestra de seguridad...");
        filtradas = impianti.filter(imp => imp.Latitudine && imp.Longitudine).slice(0, 50);
    }

    const resultadoFinal = filtradas.map(imp => {
        // 1. Buscamos los precios de esta estación y nos quedamos SOLO con los "isSelf === 1"
        const listaPreciosSelf = precios.filter(p => p.idImpianto === imp.idImpianto && p.isSelf === "1");
        
        // 2. Agrupamos por tipo de combustible para elegir siempre el más barato
        const mapaCombustibles = {};
        
        listaPreciosSelf.forEach(p => {
            const nombreCombustible = p.descCarburante;
            const precioActual = parseFloat(p.prezzo);
            
            if (!isNaN(precioActual)) {
                if (!mapaCombustibles[nombreCombustible] || precioActual < parseFloat(mapaCombustibles[nombreCombustible].precio)) {
                    mapaCombustibles[nombreCombustible] = {
                        combustible: nombreCombustible,
                        precio: p.prezzo
                    };
                }
            }
        });

        const carburantesLimpios = Object.values(mapaCombustibles);

        return {
            idImpianto: imp.idImpianto,
            bandiera: imp.Bandiera,
            nomeImpianto: imp.TemplateName || imp['Nome Impianto'] || imp.nomeImpianto || "S/N",
            indirizzo: imp.Indirizzo,
            comune: imp.Comune,
            latitud: imp.Latitudine,
            longitud: imp.Longitudine,
            tipoImpianto: imp['Tipo Impianto'] || "Urbano", 
            precios: carburantesLimpios.map(p => ({
                combustible: p.combustible.toLowerCase().trim(),
                precio: p.precio
            }))
        };
    }); // <--- AQUÍ SE CIERRA EL MAP DE FILTRADAS

    fs.writeFileSync('gasolineras.json', JSON.stringify(resultadoFinal, null, 2));
    console.log(`¡Proceso completado! Guardadas ${resultadoFinal.length} gasolineras optimizadas en modo Self.`);
}
procesar();
