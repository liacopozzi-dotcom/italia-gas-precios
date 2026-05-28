const fs = require('fs');
const https = require('https');

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

async function procesar() {
    console.log("Descargando y procesando todas las gasolineras...");
    const impianti = await descargarCSV(URL_IMPIANTI);
    const precios = await descargarCSV(URL_PRECIOS);

    // Procesamos TODOS los impianti sin filtrar por distancia
    const resultadoFinal = impianti.map(imp => {
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
    });

    fs.writeFileSync('gasolineras.json', JSON.stringify(resultadoFinal, null, 2));
    console.log(`¡Proceso completado! Guardadas ${resultadoFinal.length} gasolineras en total.`);
}

procesar();
