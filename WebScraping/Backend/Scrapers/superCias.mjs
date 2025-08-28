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
  let browser = null;
  
  try {
    console.log(`🔍 Iniciando consulta de Superintendencia de Compañías para: ${cedulaRuc}`);

    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Configurar timeout más corto para detección rápida
    page.setDefaultTimeout(15000); // 15 segundos por defecto

    await page.goto('https://appscvs1.supercias.gob.ec/consultaPersona/consulta_cia_param.zul', {
      waitUntil: 'domcontentloaded'
    });

    // Cerrar modal inicial
    await page.keyboard.press('Enter');
    await page.waitForSelector('input.z-combobox-inp', { timeout: 10000 });

    // Ingresar cédula/RUC
    const input = await page.$('input.z-combobox-inp');
    await input.fill(cedulaRuc, { delay: 100 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Enter');

    // Forzar blur para que reconozca el cambio
    await page.evaluate(() => {
      const combobox = document.querySelector('.z-combobox-inp');
      combobox.blur();
      combobox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.click('button.z-button');
    
    console.log('🔄 Esperando resultados...');

    // ✅ NUEVA LÓGICA: Esperar con timeout más corto y verificar si hay datos
    try {
      await page.waitForSelector('tr.z-listitem', { timeout: 20000 });
    } catch (timeoutError) {
      console.log('⏰ Timeout esperando datos - posiblemente no registrado');
      
      // Verificar si hay mensaje de "no encontrado" o página vacía
      const noDataMessage = await page.$eval('body', (body) => {
        const text = body.textContent.toLowerCase();
        return text.includes('no se encontr') || 
               text.includes('sin registros') || 
               text.includes('no existe') ||
               text.includes('no hay datos') ||
               text.includes('no hay información');
      }).catch(() => false);

      // Si no hay mensaje específico pero tampoco hay datos, asumir no registrado
      const hasData = await page.$('tr.z-listitem').catch(() => null);
      
      if (!hasData) {
        console.log('📋 No se encontraron registros en la Superintendencia de Compañías');
        
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
        await DatabaseOperations.upsert(
          Collections.SUPERCIAS_EMPRESAS,
          { cedulaRuc },
          datosNoRegistrado
        );

        return datosNoRegistrado;
      }
    }

    // Analizar el tipo de persona del RUC/cédula ingresado
    const tipoPersonaIngresada = esPersonaNatural(cedulaRuc) ? 'Persona Natural' : 'Persona Jurídica';
    console.log(`📋 Análisis del documento ingresado: ${cedulaRuc} -> ${tipoPersonaIngresada}`);

    // Buscar TODAS las tablas que tengan filas de datos
    const todasLasTablas = await page.$$('.z-listbox');
    
    console.log(`Se encontraron ${todasLasTablas.length} contenedores de tabla`);
    
    const tablasConDatos = [];

    for (let i = 0; i < todasLasTablas.length; i++) {
      const tabla = todasLasTablas[i];
      
      // Verificar si esta tabla tiene filas de datos
      const rows = await tabla.$$('tr.z-listitem');
      
      if (rows.length === 0) {
        continue;
      }
      
      // Buscar el título de esta tabla
      let titulo = 'Tabla sin título';
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
        }
      } catch (e) {
        // Si no puede encontrar título, usar genérico
      }
      
      console.log(`📊 Procesando: ${titulo} (${rows.length} filas)`);
      
      // Obtener encabezados de esta tabla específica
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
      
      // Extraer datos de cada fila
      const filas = [];
      for (let j = 0; j < rows.length; j++) {
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
        tablasConDatos.push({
          titulo,
          headers,
          filas,
          totalFilas: filas.length
        });
      }
    }

    // ✅ NUEVA VERIFICACIÓN: Si entramos pero no hay tablas con datos
    if (tablasConDatos.length === 0) {
      console.log('📋 Se cargó la página pero no se encontraron tablas con datos');
      
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
      await DatabaseOperations.upsert(
        Collections.SUPERCIAS_EMPRESAS,
        { cedulaRuc },
        datosNoRegistrado
      );

      console.log(`💾 Datos guardados en base de datos para: ${cedulaRuc} (no registrado)`);
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

    console.log(`✅ Consulta completada - ${tablasConDatos.length} tablas con datos encontradas`);

    // Guardar en base de datos usando el modelo
    await DatabaseOperations.upsert(
      Collections.SUPERCIAS_EMPRESAS,
      { cedulaRuc },
      datosConsulta
    );

    console.log(`💾 Datos guardados en base de datos para: ${cedulaRuc}`);

    return datosConsulta;

  } catch (error) {
    console.error("❌ Error en obtenerSuperciasEmpresas:", error.message);
    
    // ✅ MEJORA: Distinguir entre timeout y otros errores
    let mensajeError = error.message;
    let estadoError = 'error';
    
    if (error.message.includes('Timeout') || error.message.includes('timeout')) {
      mensajeError = 'No se encontraron registros en la Superintendencia de Compañías (timeout)';
      estadoError = 'no_registrado';
      console.log('⏰ Timeout detectado - probablemente no registrado');
    }
    
    // Guardar error en logs de errores
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
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));
    
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
      await DatabaseOperations.upsert(
        Collections.SUPERCIAS_EMPRESAS,
        { cedulaRuc },
        datosError
      );
    } catch (dbError) {
      console.error("❌ Error guardando en base de datos:", dbError.message);
    }

    // ✅ Si es timeout/no registrado, no lanzar error
    if (estadoError === 'no_registrado') {
      return datosError;
    }

    throw new Error(mensajeError);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}