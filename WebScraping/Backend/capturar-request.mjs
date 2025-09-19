import { chromium } from 'playwright';

async function capturarSolicitudReal() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Interceptar solicitudes de red
  const requests = [];
  
  page.on('request', request => {
    if (request.url().includes('consulta.jsf') && request.method() === 'POST') {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });

  try {
    await page.goto('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf');
    
    // Llenar la cédula y hacer clic en buscar
    await page.fill('#form\\:t_texto_cedula', '0706151594');
    await page.click('#form\\:b_buscar_cedula');
    
    // Esperar a que se complete la búsqueda
    await page.waitForTimeout(5000);
    
    // Verificar resultados
    const hasResults = await page.locator('#form\\:j_idt57_data > tr').count();
    console.log(`Resultados encontrados: ${hasResults}`);
    
    if (hasResults > 0) {
      console.log('✅ Datos encontrados con Playwright');
    }
    
    // Mostrar las solicitudes capturadas
    console.log('\n=== SOLICITUDES CAPTURADAS ===');
    requests.forEach((req, index) => {
      console.log(`\nSolicitud ${index + 1}:`);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('POST Data:', req.postData);
    });
    
  } finally {
    await browser.close();
  }
}

capturarSolicitudReal().catch(console.error);
