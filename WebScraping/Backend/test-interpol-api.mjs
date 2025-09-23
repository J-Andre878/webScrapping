import { obtenerInterpol } from './Scrapers/interpol.mjs';

async function test() {
  const nombre = 'JUAN';
  const apellido = '';
  console.log('🧪 Probando scraper de Interpol SOLO API');
  try {
    const resultado = await obtenerInterpol(nombre, apellido);
    console.log('\n=== RESULTADO ===');
    console.log('Clave:', resultado.clave);
    console.log('Cantidad resultados:', resultado.cantidadResultados);
    console.log('Homónimo:', resultado.homonimo);
    console.log('Método usado:', resultado.metodoUsado);
    if (!resultado.avisos || resultado.avisos.length === 0) {
      console.log('⚠️ No se encontraron avisos rojos para esta búsqueda.');
    } else {
      console.log('Avisos:', resultado.avisos);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

test();
