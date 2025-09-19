import { chromium } from 'playwright';

async function capturarSolicitudPlaywright() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  let interceptedRequest = null;
  
  // Interceptar TODAS las solicitudes POST
  page.on('request', request => {
    if (request.method() === 'POST') {
      console.log(`POST REQUEST: ${request.url()}`);
      if (request.postData()) {
        console.log(`POST DATA: ${request.postData().substring(0, 200)}...`);
      }
      
      if (request.url().includes('consulta.jsf')) {
        interceptedRequest = {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        };
        console.log('=== SOLICITUD CAPTURADA ===');
        console.log('Headers:', JSON.stringify(request.headers(), null, 2));
        console.log('POST Data completo:', request.postData());
      }
    }
  });

  try {
    console.log('1. Navegando al sitio...');
    await page.goto('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf', {
      waitUntil: 'domcontentloaded'
    });
    
    console.log('2. Llenando cédula...');
    await page.fill('#form\\:t_texto_cedula', '0706151594');
    
    console.log('3. Haciendo clic en buscar...');
    await page.click('#form\\:b_buscar_cedula');
    
    // Esperar a que aparezcan los resultados
    await page.waitForTimeout(5000);
    
    console.log('4. Verificando resultados...');
    const results = await page.locator('tbody[id*="_data"] > tr').count();
    console.log(`Filas encontradas: ${results}`);
    
    if (results > 0) {
      const firstRow = await page.locator('tbody[id*="_data"] > tr').first();
      const codigo = await firstRow.locator('td').first().textContent();
      console.log(`Código encontrado: ${codigo}`);
    }
    
  } finally {
    await browser.close();
  }
  
  return interceptedRequest;
}

const request = await capturarSolicitudPlaywright();
if (request) {
  console.log('\n=== ANÁLISIS DE LA SOLICITUD ===');
  console.log('POST Data decodificado:');
  const params = new URLSearchParams(request.postData);
  for (const [key, value] of params.entries()) {
    console.log(`${key}: ${value}`);
  }
}
