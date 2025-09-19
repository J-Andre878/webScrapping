// Análisis de APIs para procesos judiciales
async function analizarAPIs() {
  console.log('=== ANALIZANDO APIs DE PROCESOS JUDICIALES ===');
  
  try {
    // Cargar la página inicial para ver qué APIs usa
    const response = await fetch('https://procesosjudiciales.funcionjudicial.gob.ec/busqueda-filtros');
    console.log('Página principal status:', response.status);
    
    const html = await response.text();
    
    // Buscar posibles endpoints de API en el JavaScript
    const apiMatches = html.match(/\/api\/[^"'\s]+/g);
    if (apiMatches) {
      console.log('APIs encontradas en JS:', [...new Set(apiMatches)]);
    }
    
    // Buscar endpoints específicos
    const endpointMatches = html.match(/https?:\/\/[^"'\s]+\/[^"'\s]*/g);
    if (endpointMatches) {
      const uniqueEndpoints = [...new Set(endpointMatches)]
        .filter(url => url.includes('funcionjudicial') || url.includes('api'));
      console.log('Endpoints encontrados:', uniqueEndpoints);
    }
    
    // Buscar formularios y sus actions
    const formMatches = html.match(/<form[^>]*>/g);
    if (formMatches) {
      console.log('Formularios encontrados:', formMatches.length);
    }
    
    // Buscar scripts con configuración
    const configMatches = html.match(/config[^=]*=[^;]*/gi);
    if (configMatches) {
      console.log('Configuraciones encontradas:', configMatches.slice(0, 3));
    }
    
  } catch (error) {
    console.error('Error analizando APIs:', error.message);
  }
}

analizarAPIs().catch(console.error);
