import { chromium } from 'playwright'
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

function esPersonaNatural(ruc) {
  if (!ruc || typeof ruc !== 'string') return false;
  if (ruc.length === 10) return true;
  if (ruc.length === 13 && /^[0-9]{10}001$/.test(ruc)) {
    const tercerDigito = parseInt(ruc[2]);
    return tercerDigito >= 0 && tercerDigito <= 5;
  }
  return false;
}

export const obtenerSuperciasEmpresas = async (cedulaRuc) => {
  console.log(`🔍 SuperCías - Iniciando consulta para: ${cedulaRuc}`)
  let browser = null;
  
  try {
    console.log(`� SuperCías - Lanzando navegador...`)

    browser = await chromium.launch({ 
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    console.log(`✅ SuperCías - Navegador lanzado exitosamente`)
    
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log(`📄 SuperCías - Nueva página creada`)

    // Configurar timeout más corto para detección rápida
    page.setDefaultTimeout(15000); // 15 segundos por defecto
    console.log(`⏱️ SuperCías - Timeout configurado a 15 segundos`)

    console.log(`🌐 SuperCías - Navegando a página de consulta...`)
    await page.goto('https://appscvs1.supercias.gob.ec/consultaPersona/consulta_cia_param.zul', {
      waitUntil: 'domcontentloaded'
    });
    console.log(`📄 SuperCías - Página cargada. Título: ${await page.title()}`)

    // Cerrar modal inicial
    console.log(`🔐 SuperCías - Cerrando modal inicial...`)
    await page.keyboard.press('Enter');
    await page.waitForSelector('input.z-combobox-inp', { timeout: 10000 });
    console.log(`✅ SuperCías - Modal cerrado, campo de entrada disponible`)

    // Ingresar cédula/RUC
    console.log(`📝 SuperCías - Ingresando cédula/RUC: ${cedulaRuc}`)
    const input = await page.$('input.z-combobox-inp');
    await input.fill(cedulaRuc, { delay: 100 });
    console.log(`⌨️ SuperCías - Cédula ingresada, navegando opciones...`)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Enter');

    // Forzar blur para que reconozca el cambio
    console.log(`🔄 SuperCías - Forzando reconocimiento del campo...`)
    await page.evaluate(() => {
      const combobox = document.querySelector('.z-combobox-inp');
      combobox.blur();
      combobox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    console.log(`🔍 SuperCías - Haciendo clic en botón de búsqueda...`)
    await page.click('button.z-button');
    
    console.log('🔄 SuperCías - Esperando resultados...');

    // ✅ NUEVA LÓGICA: Esperar con timeout más corto y verificar si hay datos
    try {
      console.log(`⏳ SuperCías - Buscando elementos de resultados (tr.z-listitem)...`)
      await page.waitForSelector('tr.z-listitem', { timeout: 20000 });
      console.log(`✅ SuperCías - Elementos de resultados encontrados`)
    } catch (timeoutError) {
      console.log('⏰ SuperCías - Timeout esperando datos - posiblemente no registrado');
      
      // Verificar si hay mensaje de "no encontrado" o página vacía
      console.log(`🔍 SuperCías - Verificando mensajes de "no encontrado"...`)
      const noDataMessage = await page.$eval('body', (body) => {
        const text = body.textContent.toLowerCase();
        return text.includes('no se encontr') || 
               text.includes('sin registros') || 
               text.includes('no existe') ||
               text.includes('no hay datos') ||
               text.includes('no hay información');
      }).catch(() => false);
      console.log(`📋 SuperCías - Mensaje de no datos encontrado: ${noDataMessage}`)

      // Si no hay mensaje específico pero tampoco hay datos, asumir no registrado
      console.log(`🔍 SuperCías - Verificando si hay elementos de datos...`)
      const hasData = await page.$('tr.z-listitem').catch(() => null);
      console.log(`📊 SuperCías - Elementos de datos encontrados: ${hasData ? 'Sí' : 'No'}`)
      
      if (!hasData) {
        console.log('📋 SuperCías - No se encontraron registros en la Superintendencia de Compañías');
        
        const datosNoRegistrado = {
          cedulaRuc,
          tipoPersona: esPersonaNatural(cedulaRuc) ? 'Persona Natural' : 'Persona Jurídica',
          tablas: [],
          fechaConsulta: new Date(),
          estado: 'no_registrado',
          totalTablas: 0,
          totalRegistros: 0,
          mensaje: 'No se encontraron registros en la Superintendencia de Compañías'
        };

        // Guardar en base de datos
        console.log(`💾 SuperCías - Guardando resultado "no registrado" en base de datos...`)
        await DatabaseOperations.upsert(
          Collections.SUPERCIAS_EMPRESAS,
          { cedulaRuc },
          datosNoRegistrado
        );
        console.log(`✅ SuperCías - Resultado guardado exitosamente`)

        return datosNoRegistrado;
      }
    }

    // Analizar el tipo de persona del RUC/cédula ingresado
    const tipoPersonaIngresada = esPersonaNatural(cedulaRuc) ? 'Persona Natural' : 'Persona Jurídica';
    console.log(`📋 SuperCías - Análisis del documento ingresado: ${cedulaRuc} -> ${tipoPersonaIngresada}`);

    // Buscar TODAS las tablas que tengan filas de datos
    console.log(`🔍 SuperCías - Buscando todas las tablas con datos...`)
    const todasLasTablas = await page.$$('.z-listbox');
    
    console.log(`📊 SuperCías - Se encontraron ${todasLasTablas.length} contenedores de tabla`);
    
    const tablasConDatos = [];

    for (let i = 0; i < todasLasTablas.length; i++) {
      console.log(`🔍 SuperCías - Procesando tabla ${i + 1}/${todasLasTablas.length}...`)
      const tabla = todasLasTablas[i];
      
      // Verificar si esta tabla tiene filas de datos
      const rows = await tabla.$$('tr.z-listitem');
      console.log(`📊 SuperCías - Tabla ${i + 1} tiene ${rows.length} filas de datos`)
      
      if (rows.length === 0) {
        console.log(`⏭️ SuperCías - Saltando tabla ${i + 1} (sin datos)`)
        continue;
      }
      
      // Buscar el título de esta tabla
      let titulo = 'Tabla sin título';
      console.log(`🏷️ SuperCías - Buscando título para tabla ${i + 1}...`)
      try {
        const tituloElement = await page.evaluateHandle((tabla) => {
          let elemento = tabla.parentElement;
          while (elemento) {
            const caption = elemento.querySelector('td[class="z-caption-l"]');
            if (caption) {
              return caption;
            }
            elemento = elemento.previousElementSibling;
          }
          return null;
        }, tabla);
        
        if (tituloElement) {
          titulo = await tituloElement.evaluate(el => el.textContent.trim());
          console.log(`📝 SuperCías - Título encontrado para tabla ${i + 1}: "${titulo}"`)
        } else {
          console.log(`❓ SuperCías - No se encontró título para tabla ${i + 1}`)
        }
      } catch (e) {
        console.log(`⚠️ SuperCías - Error buscando título tabla ${i + 1}: ${e.message}`)
        // Si no puede encontrar título, usar genérico
      }
      
      console.log(`📊 Procesando: ${titulo} (${rows.length} filas)`);
      
      // Obtener encabezados de esta tabla específica
      console.log(`📋 SuperCías - Extrayendo encabezados de tabla ${i + 1}...`)
      const headers = await tabla.$$eval('tr.z-listhead th.z-listheader', headers => {
        return headers.map(th => {
          const content = th.querySelector('.z-listheader-cnt');
          if (content) {
            // Buscar sub-elementos para encabezados compuestos
            const subHeaders = content.querySelectorAll('.z-vlayout .z-label');
            if (subHeaders.length > 0) {
              return Array.from(subHeaders).map(label => label.textContent.trim()).join(' ');
            } else {
              return content.textContent.trim();
            }
          }
          return '';
        }).filter(h => h !== '');
      });
      console.log(`📊 SuperCías - Tabla ${i + 1} tiene ${headers.length} columnas: [${headers.join(', ')}]`)
      
      // Extraer datos de cada fila
      console.log(`📄 SuperCías - Extrayendo datos de ${rows.length} filas en tabla ${i + 1}...`)
      const filas = [];
      for (let j = 0; j < rows.length; j++) {
        console.log(`📝 SuperCías - Procesando fila ${j + 1}/${rows.length} de tabla ${i + 1}...`)
        const row = rows[j];
        const cells = await row.$$('td.z-listcell');
        
        const filaData = {};
        
        for (let k = 0; k < cells.length && k < headers.length; k++) {
          const cell = cells[k];
          let cellText = '';
          
          try {
            cellText = await cell.innerText();
            cellText = cellText.trim();
          } catch (e) {
            try {
              cellText = await cell.evaluate(el => {
                const content = el.querySelector('.z-listcell-cnt');
                return content ? content.textContent.trim() : '';
              });
            } catch (e2) {
              cellText = '';
            }
          }
          
          const header = headers[k] || `Columna ${k + 1}`;
          filaData[header] = cellText;
        }
        
        filas.push(filaData);
      }
      
      if (filas.length > 0) {
        console.log(`✅ SuperCías - Tabla ${i + 1} procesada: "${titulo}" con ${filas.length} filas`)
        tablasConDatos.push({
          titulo,
          headers,
          filas,
          totalFilas: filas.length
        });
      } else {
        console.log(`⚠️ SuperCías - Tabla ${i + 1} sin datos válidos`)
      }
    }

    // ✅ NUEVA VERIFICACIÓN: Si entramos pero no hay tablas con datos
    console.log(`📊 SuperCías - Procesamiento completado. ${tablasConDatos.length} tablas con datos encontradas`)
    if (tablasConDatos.length === 0) {
      console.log('📋 SuperCías - Se cargó la página pero no se encontraron tablas con datos');
      
      const datosNoRegistrado = {
        cedulaRuc,
        tipoPersona: tipoPersonaIngresada,
        tablas: [],
        fechaConsulta: new Date(),
        estado: 'no_registrado',
        totalTablas: 0,
        totalRegistros: 0,
        mensaje: 'No se encontraron registros en la Superintendencia de Compañías'
      };

      // Guardar en base de datos
      console.log(`💾 SuperCías - Guardando resultado "no registrado" en base de datos...`)
      await DatabaseOperations.upsert(
        Collections.SUPERCIAS_EMPRESAS,
        { cedulaRuc },
        datosNoRegistrado
      );
      console.log(`✅ SuperCías - Resultado "no registrado" guardado exitosamente`)

      console.log(`💾 SuperCías - Datos guardados en base de datos para: ${cedulaRuc} (no registrado)`);
      return datosNoRegistrado;
    }

    const datosConsulta = {
      cedulaRuc,
      tipoPersona: tipoPersonaIngresada,
      tablas: tablasConDatos,
      fechaConsulta: new Date(),
      estado: 'exitoso',
      totalTablas: tablasConDatos.length,
      totalRegistros: tablasConDatos.reduce((sum, tabla) => sum + tabla.totalFilas, 0)
    };

    console.log(`✅ SuperCías - Consulta completada - ${tablasConDatos.length} tablas con datos encontradas`);
    console.log(`📊 SuperCías - Total de registros encontrados: ${datosConsulta.totalRegistros}`);

    // Guardar en base de datos usando el modelo
    console.log(`💾 SuperCías - Guardando datos en base de datos...`)
    await DatabaseOperations.upsert(
      Collections.SUPERCIAS_EMPRESAS,
      { cedulaRuc },
      datosConsulta
    );

    console.log(`✅ SuperCías - Datos guardados exitosamente en base de datos para: ${cedulaRuc}`);

    return datosConsulta;

  } catch (error) {
    console.error("❌ SuperCías - Error en obtenerSuperciasEmpresas:", error.message);
    
    // ✅ MEJORA: Distinguir entre timeout y otros errores
    let mensajeError = error.message;
    let estadoError = 'error';
    
    if (error.message.includes('Timeout') || error.message.includes('timeout')) {
      mensajeError = 'No se encontraron registros en la Superintendencia de Compañías (timeout)';
      estadoError = 'no_registrado';
      console.log('⏰ SuperCías - Timeout detectado - probablemente no registrado');
    }
    
    // Guardar error en logs de errores
    console.log(`📝 SuperCías - Guardando log de error...`)
    await ErrorLogsModel.saveError(
      'supercias-empresas',
      cedulaRuc,
      estadoError === 'no_registrado' ? 'timeout' : 'error_general',
      { 
        mensaje: mensajeError,
        stack: error.stack,
        tipo: error.name || 'Error',
        tipoPersona: esPersonaNatural(cedulaRuc) ? 'Persona Natural' : 'Persona Jurídica'
      }
    ).catch(err => console.warn('⚠️ SuperCías - Error guardando log:', err.message));
    
    // Guardar error en base de datos
    const datosError = {
      cedulaRuc,
      tipoPersona: esPersonaNatural(cedulaRuc) ? 'Persona Natural' : 'Persona Jurídica',
      fechaConsulta: new Date(),
      estado: estadoError,
      error: mensajeError,
      tablas: [],
      totalTablas: 0,
      totalRegistros: 0
    };

    try {
      console.log(`💾 SuperCías - Guardando datos de error en base de datos...`)
      await DatabaseOperations.upsert(
        Collections.SUPERCIAS_EMPRESAS,
        { cedulaRuc },
        datosError
      );
      console.log(`✅ SuperCías - Datos de error guardados exitosamente`)
    } catch (dbError) {
      console.error("❌ SuperCías - Error guardando en base de datos:", dbError.message);
    }

    // ✅ Si es timeout/no registrado, no lanzar error
    if (estadoError === 'no_registrado') {
      console.log(`📋 SuperCías - Retornando resultado de no registrado`)
      return datosError;
    }

    throw new Error(mensajeError);
  } finally {
    if (browser) {
      console.log(`🔒 SuperCías - Cerrando navegador...`)
      await browser.close();
      console.log(`✅ SuperCías - Navegador cerrado exitosamente`)
    }
  }
}