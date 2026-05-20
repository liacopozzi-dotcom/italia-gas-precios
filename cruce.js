const fs = require('fs');

// Importamos la configuración que definiremos en autopistasItalia.js
const config = require('./autopistasItalia.js');

// Función matemática para calcular la distancia entre dos puntos GPS (fórmula de Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function procesar() {
    console.log("Iniciando filtrado de gasolineras...");
    
    // Aquí más adelante cargaremos los datos reales del Gobierno
    const todasLasGasolineras = []; // Temporalmente vacío
    const filtradas = [];

    todasLasGasolineras.forEach(gas => {
        // Comprobar si está cerca de alguno de tus puntos de ruta
        const estaCerca = config.rutaPuntos.some(punto => 
            calcularDistancia(gas.lat, gas.lon, punto.lat, punto.lon) <= config.radioKM
        );

        if (estaCerca) {
            filtradas.push(gas);
        }
    });

    fs.writeFileSync('gasolineras.json', JSON.stringify(filtradas, null, 2));
    console.log(`Proceso completado. Gasolineras encontradas: ${filtradas.length}`);
}

procesar();
