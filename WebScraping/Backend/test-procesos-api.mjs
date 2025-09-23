import { obtenerProcesosJudiciales } from './Scrapers/procesosJudiciales.mjs';

async function test() {
  const cedula = '0706151594';
  console.log('🧪 Probando scraper de procesos judiciales SOLO API');
  try {
    const resultado = await obtenerProcesosJudiciales(cedula);
    console.log('\n=== RESULTADO ===');
    console.log('Cédula:', resultado.cedula);
    console.log('Total actor:', resultado.totalProcesosActor);
    console.log('Total demandado:', resultado.totalProcesosDemandado);
    console.log('Estado:', resultado.estado);
    console.log('Procesos actor:', resultado.procesos.resultadosActor);
    console.log('Procesos demandado:', resultado.procesos.resultadosDemandado);
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

test();
