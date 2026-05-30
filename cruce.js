const fs = require('fs');
const https = require('https');

const URL_IMPIANTI = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const URL_PRECIOS  = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

function descargarCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.setEncoding('latin1');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let lineas = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let aggiornamento = '';
        if (lineas[0] && lineas[0].includes('Estrazione del')) {
          aggiornamento = lineas[0].replace('Estrazione del', '').trim();
          lineas = lineas.slice(1);
        }

        if (lineas.length === 0) { resolve({ rows: [], aggiornamento }); return; }

        const cabeceras = lineas[0].split('|').map(h => h.trim());
        const rows = lineas.slice(1).map(linea => {
          const valores = linea.split('|');
          let obj = {};
          cabeceras.forEach((h, i) => { obj[h] = valores[i] ? valores[i].trim() : ''; });
          return obj;
        });
        resolve({ rows, aggiornamento });
      });
    }).on('error', reject);
  });
}

async function procesar() {
  console.log('Descargando y procesando todas las gasolineras...');
  const { rows: impianti, aggiornamento } = await descargarCSV(URL_IMPIANTI);
  const { rows: precios }                  = await descargarCSV(URL_PRECIOS);

  const stazioni = impianti.map(imp => {
    const listaSelf = precios.filter(p => p.idImpianto === imp.idImpianto && p.isSelf === '1');
    const mapaComb = {};
    listaSelf.forEach(p => {
      const nombre = p.descCarburante;
      const val    = parseFloat(p.prezzo);
      if (!isNaN(val) && (!mapaComb[nombre] || val < parseFloat(mapaComb[nombre].precio))) {
        mapaComb[nombre] = { combustible: nombre, precio: p.prezzo };
      }
    });
    return {
      idImpianto: imp.idImpianto,
      bandiera:   imp.Bandiera,
      nomeImpianto: imp.TemplateName || imp['Nome Impianto'] || imp.nomeImpianto || 'S/N',
      indirizzo:  imp.Indirizzo,
      comune:     imp.Comune,
      latitud:    imp.Latitudine,
      longitud:   imp.Longitudine,
      tipoImpianto: imp['Tipo Impianto'] || 'Urbano',
      precios: Object.values(mapaComb).map(p => ({
        combustible: p.combustible.toLowerCase().trim(),
        precio: p.precio
      }))
    };
  });

  const output = { aggiornamento, stazioni };
  fs.writeFileSync('gasolineras.json', JSON.stringify(output));
  console.log(`¡Completado! ${stazioni.length} gasolineras. Última actualización MIMIT: ${aggiornamento}`);
}

procesar();
