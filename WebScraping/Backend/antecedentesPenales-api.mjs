// Antecedentes Penales - Versión API-first (modernizada)
import { chromium } from 'playwright';

/**
 * Función auxiliar para manejar el captcha
 * @param {Object} page - Página de Playwright
 * @returns {boolean} - True si el captcha fue manejado exitosamente
 */
async function manejarCaptcha(page) {
  try {
    // Verificar si hay captcha hCaptcha
    const captchaFrame = page.locator('iframe[src*="hcaptcha"]').first();
    if (await captchaFrame.isVisible({ timeout: 5000 })) {
      console.log('🔒 Se detectó captcha hCaptcha');
      console.log('⏰ Esperando 60 segundos para completar captcha manualmente...');
      await page.waitForTimeout(60000);
      return true;
    }
    
    // Verificar si hay captcha Incapsula
    const incapsulaElement = page.locator('[data-cy="challenge"]').first();
    if (await incapsulaElement.isVisible({ timeout: 2000 })) {
      console.log('🔒 Se detectó protección Incapsula');
      console.log('⏰ Esperando 30 segundos para resolución automática...');
      await page.waitForTimeout(30000);
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('ℹ️ No se detectó captcha o ya fue resuelto');
    return false;
  }
}

/**
 * Función principal para consultar antecedentes penales usando APIs
 * @param {string} cedula - Número de cédula a consultar
 * @returns {Object} - Resultado de la consulta
 */
export async function consultarAntecedentesPenalesAPI(cedula) {
  console.log(`🔍 Consultando antecedentes penales para cédula: ${cedula}`);
  
  let browser = null;
  let response = {
    success: false,
    data: null,
    error: null,
    source: 'api'
  };

  try {
    // Lanzar navegador para manejo de cookies/sesión
    browser = await chromium.launch({
      headless: false, // Mantener visible para captcha manual
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Configurar user agent
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    });
    
    // Ir a la página principal
    console.log('📋 Navegando a antecedentes penales...');
    await page.goto('https://certificados.ministeriodelinterior.gob.ec/gestorcertificados/antecedentes/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Manejar captcha si aparece
    await manejarCaptcha(page);
    
    // Esperar a que cargue el formulario
    await page.waitForSelector('input[name="cedula"], #txtCi', { timeout: 15000 });
    
    // Ingresar cédula
    console.log('📝 Ingresando cédula...');
    await page.fill('input[name="cedula"], #txtCi', cedula);
    
    // Hacer clic en siguiente (primer paso)
    console.log('🔍 Procesando paso 1...');
    await page.click('#siguiente, #btnSig1, button[type="submit"], .btn-primary');
    
    // Primer API call - GetData
    console.log('📡 Realizando primera llamada API...');
    const primeraRespuesta = await page.evaluate(async (cedula) => {
      const body = `code=${encodeURIComponent(`WSgetData%${cedula}%C%SI%ECU`)}`;
      
      const response = await fetch('/gestorcertificados/antecedentes/function.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body
      });
      
      return await response.text();
    }, cedula);
    
    console.log('📋 Respuesta primera API:', primeraRespuesta);

    // Esperar a que aparezca el formulario del motivo
    await page.waitForSelector('select[name="motivo"], #motivo, #txtMotivo', { timeout: 10000 });
    
    // Seleccionar motivo
    console.log('📋 Seleccionando motivo...');
    const motivoSelector = await page.locator('select[name="motivo"], #motivo').first();
    if (await motivoSelector.isVisible()) {
      await motivoSelector.selectOption('9450850'); // Consulta Personal
    } else {
      // Si no hay select, llenar campo de texto
      await page.fill('#txtMotivo', 'Consulta Personal');
    }
    
    // Segunda API call - Process
    console.log('📡 Realizando segunda llamada API...');
    const segundaRespuesta = await page.evaluate(async () => {
      // Generar código de proceso único
      const timestamp = Date.now().toString();
      const processCode = `process%60${timestamp.slice(-10)}b`;
      const body = `code=${encodeURIComponent(processCode)}`;
      
      const response = await fetch('/gestorcertificados/antecedentes/index.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body
      });
      
      return await response.text();
    });
    
    console.log('📋 Respuesta segunda API:', segundaRespuesta);

    // Manejar captcha antes del paso final
    await manejarCaptcha(page);

    // Continuar al paso final
    console.log('🔍 Procesando paso final...');
    await page.click('#continuar, #siguiente, #btnSig2, button[type="submit"]');
    
    // Tercera API call - SetMotive  
    console.log('📡 Realizando tercera llamada API...');
    const terceraRespuesta = await page.evaluate(async () => {
      const body = `code=${encodeURIComponent('setMotive%9450850%Consulta Personal')}`;
      
      const response = await fetch('/gestorcertificados/antecedentes/function.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body
      });
      
      return await response.text();
    });
    
    console.log('📋 Respuesta tercera API:', terceraRespuesta);

    // Esperar y capturar el resultado final
    console.log('⏳ Esperando resultado final...');
    await page.waitForTimeout(5000);
    
    // Buscar el resultado en la página
    const resultado = await page.evaluate(() => {
      // Buscar certificado o resultado
      const certificado = document.querySelector('.certificado, .resultado, #resultado, #dvAntecedent1');
      if (certificado) {
        return {
          texto: certificado.innerText,
          html: certificado.innerHTML
        };
      }
      
      // Buscar mensajes de error o éxito
      const mensaje = document.querySelector('.alert, .message, .error, .success');
      if (mensaje) {
        return {
          texto: mensaje.innerText,
          html: mensaje.innerHTML
        };
      }
      
      // Capturar todo el contenido si no encuentra elementos específicos
      return {
        texto: document.body.innerText,
        html: document.body.innerHTML
      };
    });

    response.success = true;
    response.data = {
      cedula: cedula,
      resultado: resultado,
      apis_utilizadas: [
        { endpoint: '/function.php', action: 'WSgetData' },
        { endpoint: '/index.php', action: 'process' },
        { endpoint: '/function.php', action: 'setMotive' }
      ]
    };
    
    console.log('✅ Consulta completada exitosamente usando APIs');

  } catch (error) {
    console.error('❌ Error en consulta API:', error.message);
    response.error = error.message;
    response.success = false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return response;
}

/**
 * Función de fallback usando Playwright tradicional
 * @param {string} cedula - Número de cédula a consultar  
 * @returns {Object} - Resultado de la consulta
 */
export async function consultarAntecedentesPenalesFallback(cedula) {
  console.log(`🔄 Usando método fallback para cédula: ${cedula}`);
  
  let browser = null;
  let response = {
    success: false,
    data: null,
    error: null,
    source: 'fallback'
  };

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://certificados.ministeriodelinterior.gob.ec/gestorcertificados/antecedentes/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Proceso tradicional de llenado de formulario
    await page.waitForSelector('input[name="cedula"], #txtCi', { timeout: 15000 });
    await page.fill('input[name="cedula"], #txtCi', cedula);
    await page.click('#siguiente, #btnSig1');
    
    // Manejar captcha
    await manejarCaptcha(page);
    
    await page.waitForSelector('select[name="motivo"], #txtMotivo', { timeout: 10000 });
    
    const motivoSelector = await page.locator('select[name="motivo"]').first();
    if (await motivoSelector.isVisible()) {
      await motivoSelector.selectOption('9450850');
    } else {
      await page.fill('#txtMotivo', 'Consulta Personal');
    }
    
    await page.click('#continuar, #btnSig2');
    
    // Capturar resultado final
    await page.waitForTimeout(10000);
    
    const resultado = await page.evaluate(() => {
      const certificado = document.querySelector('.certificado, .resultado, #dvAntecedent1');
      return certificado ? certificado.innerText : document.body.innerText;
    });

    response.success = true;
    response.data = { cedula, resultado };
    
    console.log('✅ Consulta fallback completada');

  } catch (error) {
    console.error('❌ Error en fallback:', error.message);
    response.error = error.message;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return response;
}

/**
 * Función principal híbrida (API-first con fallback)
 * @param {string} cedula - Número de cédula a consultar
 * @returns {Object} - Resultado de la consulta
 */
export default async function consultarAntecedentesPenales(cedula) {
  console.log(`🚀 Iniciando consulta híbrida para cédula: ${cedula}`);
  
  try {
    // Intentar primero con API
    const resultadoAPI = await consultarAntecedentesPenalesAPI(cedula);
    
    if (resultadoAPI.success) {
      console.log('✅ Consulta API exitosa');
      return resultadoAPI;
    }
    
    // Si falla la API, usar fallback
    console.log('🔄 API falló, intentando con método fallback...');
    const resultadoFallback = await consultarAntecedentesPenalesFallback(cedula);
    
    return resultadoFallback;
    
  } catch (error) {
    console.error('❌ Error en consulta híbrida:', error.message);
    return {
      success: false,
      data: null,
      error: error.message,
      source: 'hybrid_error'
    };
  }
}
