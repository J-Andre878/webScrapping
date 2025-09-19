// Test rápido de todos los endpoints
import fetch from 'node-fetch';

const endpoints = [
  { name: 'Datos IESS', url: '/api/datos-iess', body: { cedula: '0706151594' } },
  { name: 'Citaciones ANT', url: '/api/citaciones-ant', body: { cedula: '0706151594' } },
  { name: 'Citación Judicial', url: '/api/citaciones-judiciales', body: { cedula: '0706151594' } },
  { name: 'Consejo Judicatura', url: '/api/consejo-judicatura', body: { criterio: 'apellidos', valor: 'TORRES' } },
  { name: 'Consulta SRI', url: '/api/consulta-sri', body: { ruc: '1713449831001' } },
  { name: 'Impedimentos', url: '/api/impedimentos-cargos-publicos', body: { cedula: '0706151594' } },
  { name: 'Pensión Alimenticia', url: '/api/pension-alimenticia', body: { cedula: '0706151594' } },
  { name: 'Procesos Judiciales', url: '/api/procesos-judiciales', body: { cedula: '0706151594' } },
  { name: 'Senescyt', url: '/api/senescyt', body: { cedula: '0706151594' } },
  { name: 'SRI Deudas', url: '/api/sri-deudas', body: { cedula: '0706151594' } },
  { name: 'SuperCías', url: '/api/supercias-empresas', body: { ruc: '1713449831001' } },
  { name: 'Antecedentes Penales', url: '/api/antecedentes-penales', body: { cedula: '0706151594' } },
  { name: 'Interpol', url: '/api/interpol', body: { cedula: '0706151594' } }
];

async function testEndpoint(endpoint) {
  try {
    console.log(`🧪 Probando: ${endpoint.name}`);
    
    const response = await fetch(`http://localhost:3001${endpoint.url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpoint.body)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${endpoint.name}: OK - Success: ${data.success}`);
      return true;
    } else {
      console.log(`❌ ${endpoint.name}: ERROR ${response.status} - ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${endpoint.name}: EXCEPCIÓN - ${error.message}`);
    return false;
  }
}

async function testAllEndpoints() {
  console.log('🚀 PROBANDO TODOS LOS ENDPOINTS\n');
  
  let working = 0;
  let broken = 0;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) working++;
    else broken++;
    
    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 RESUMEN:`);
  console.log(`✅ Funcionando: ${working}`);
  console.log(`❌ Con problemas: ${broken}`);
  console.log(`📈 Total: ${endpoints.length}`);
}

testAllEndpoints();
