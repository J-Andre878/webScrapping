import { chromium } from 'playwright'
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

export const obtenerSRIdeudas = async (ruc) => {
  console.log(`🔍 Iniciando consulta de deudas SRI para RUC/Cédula: ${ruc}`)
  
  const browser = await chromium.launch({ 
    headless: false,  // Manteniendo headless: false como estaba
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })
  const page = await browser.newPage()
  
  try {
    console.log(`🌐 Navegando a página de deudas SRI...`)
    await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/SriPagosWeb/ConsultaDeudasFirmesImpugnadas/Consultas/consultaDeudasFirmesImpugnadas', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    console.log(`📄 Página cargada. Título: ${await page.title()}`)
    
    await page.waitForSelector('#busquedaRucId', { timeout: 60000 })
    await page.fill('#busquedaRucId', ruc)
    
    console.log(`📝 RUC/Cédula ingresada: ${ruc}`)

    // Esperar un momento para que aparezca el mensaje de error o se habilite el botón
    await page.waitForTimeout(2000)

    // Verificar si aparece el mensaje de "La búsqueda no generó resultados"
    const mensajeError = await page.locator('.ui-messages-warn .ui-messages-detail').first()
    const existeMensajeError = await mensajeError.count() > 0

    if (existeMensajeError) {
      console.log('⚠️ Detectado mensaje: La búsqueda no generó resultados')
      
      // Obtener el texto del mensaje
      const textoMensaje = await mensajeError.textContent()
      console.log(`📄 Mensaje obtenido: ${textoMensaje}`)

      // Preparar resultado con el mensaje de error
      const resultado = {
        ruc: ruc.trim(),
        rucObtenida: ruc.trim(),
        fechaCorte: '',
        razonSocial: '',
        estadoDeuda: textoMensaje?.trim() || 'La búsqueda no generó resultados',
        fechaConsulta: new Date(),
        tipoResultado: 'sin_resultados'
      }

      console.log(`📊 Resultado (sin resultados):`, {
        ruc: resultado.ruc,
        estadoDeuda: resultado.estadoDeuda,
        tipoResultado: resultado.tipoResultado
      })

      // Guardar en base de datos
      await DatabaseOperations.upsert(
        Collections.SRI_DEUDAS,
        { ruc: resultado.ruc },
        resultado
      )

      console.log(`💾 Datos de "sin resultados" guardados exitosamente en BD`)

      return { 
        success: true, 
        data: resultado, 
        estado: 'sin_resultados',
        mensaje: 'La búsqueda no generó resultados'
      }
    }

    // Si no hay mensaje de error, continuar con el flujo normal
    console.log('✅ No se detectó mensaje de error, continuando con flujo normal')
    
    // Verificar que el botón esté habilitado
    const botonConsultar = page.locator('.ui-button.cyan-btn')
    const botonHabilitado = await botonConsultar.isEnabled()
    
    if (!botonHabilitado) {
      console.log('⚠️ El botón consultar no está habilitado')
      throw new Error('El botón consultar no está habilitado')
    }

    // Hacer clic en el botón consultar
    await botonConsultar.click()
    console.log('🔘 Botón consultar presionado')

    // Esperar a que aparezcan los datos básicos de la consulta
    await page.waitForSelector('span.titulo-consultas-1.tamano-defecto-campos', { timeout: 0 })

    // Extraer datos básicos
    const rucObtenida = (await page.textContent('text=RUC / cédula >> xpath=../../..//span'))?.trim() || ''
    const fechaCorte = (await page.textContent('text=Fecha de corte >> xpath=../../..//span'))?.trim() || ''
    const razonSocial = (await page.textContent('text=Razón social / Apellidos y nombres >> xpath=../../..//span'))?.trim() || ''

    console.log(`📊 Datos básicos obtenidos - RUC: ${rucObtenida}, Razón: ${razonSocial}`)

    // Esperar específicamente a que aparezca el estado de deuda
    // Intentamos diferentes estrategias para capturar el estado
    let estadoDeuda = 'NO DETERMINADO'
    
    try {
      console.log('⏳ Esperando estado de deuda...')
      
      // Estrategia 1: Esperar el div específico que mencionaste
      const estadoVisible = await Promise.race([
        // Opción A: Elemento con mensaje de sin deudas
        page.waitForSelector('div.col-sm-12.text-center.tamano-ya-pago.animated.fadeInUp span', { timeout: 10000 })
          .then(() => 'sin-deudas'),
        
        // Opción B: Cualquier elemento con clase tamano-ya-pago
        page.waitForSelector('.tamano-ya-pago span', { timeout: 10000 })
          .then(() => 'general'),
          
        // Opción C: Esperar por contenido específico
        page.waitForFunction(() => {
          const elements = document.querySelectorAll('.tamano-ya-pago span, .col-sm-12.text-center span');
          for (let el of elements) {
            if (el.textContent && el.textContent.trim().length > 0) {
              return true;
            }
          }
          return false;
        }, {}, { timeout: 10000 }).then(() => 'contenido'),
        
        // Opción D: Timeout como fallback
        page.waitForTimeout(8000).then(() => 'timeout')
      ])

      console.log(`📋 Estado detectado: ${estadoVisible}`)

      // Intentar extraer el texto del estado de deuda con múltiples selectores
      const selectoresEstado = [
        'div.col-sm-12.text-center.tamano-ya-pago.animated.fadeInUp span',
        '.tamano-ya-pago span',
        '.col-sm-12.text-center span',
        '[class*="tamano-ya-pago"] span',
        'div[class*="text-center"] span'
      ]

      for (const selector of selectoresEstado) {
        try {
          const elemento = page.locator(selector).first()
          const count = await elemento.count()
          if (count > 0) {
            const texto = await elemento.textContent({ timeout: 2000 })
            if (texto && texto.trim().length > 0) {
              estadoDeuda = texto.trim()
              console.log(`✅ Estado encontrado con selector "${selector}": ${estadoDeuda}`)
              break
            }
          }
        } catch (e) {
          console.log(`⚠️ Selector "${selector}" no funcionó, probando siguiente...`)
          continue
        }
      }

    } catch (error) {
      console.log(`⚠️ No se pudo determinar el estado de deuda específico: ${error.message}`)
      
      // Fallback: intentar obtener cualquier texto visible relacionado con deudas
      try {
        const todosLosSpans = await page.$$eval('span', spans => 
          spans.map(span => span.textContent?.trim()).filter(text => 
            text && (
              text.includes('deuda') || 
              text.includes('pago') || 
              text.includes('contribuyente') ||
              text.includes('ciudadano') ||
              text.length > 20
            )
          )
        )
        
        if (todosLosSpans.length > 0) {
          estadoDeuda = todosLosSpans[0]
          console.log(`📄 Estado obtenido por fallback: ${estadoDeuda}`)
        }
      } catch (fallbackError) {
        console.log(`❌ Error en fallback: ${fallbackError.message}`)
      }
    }

    const resultado = {
      ruc: ruc.trim(),
      rucObtenida,
      fechaCorte,
      razonSocial,
      estadoDeuda,
      fechaConsulta: new Date(),
      tipoResultado: 'exitoso'
    }

    console.log(`📊 Resultado final:`, {
      ruc: resultado.ruc,
      estadoDeuda: resultado.estadoDeuda,
      razonSocial: resultado.razonSocial,
      tipoResultado: resultado.tipoResultado
    })

    // Guardar/actualizar en DB
    await DatabaseOperations.upsert(
      Collections.SRI_DEUDAS,
      { ruc: resultado.ruc },
      resultado
    )

    console.log(`💾 Datos guardados exitosamente en BD`)

    return { 
      success: true, 
      data: resultado, 
      estado: 'exitoso'
    }

  } catch (error) {
    console.error('❌ Error en obtenerSRIdeudas:', error.message)
    
    // Guardar error en base de datos
    await ErrorLogsModel.saveError(
      'sri-deudas',
      ruc,  // Usamos RUC en lugar de cédula
      'error_general',
      { 
        mensaje: error.message || 'Error al consultar SRI deudas',
        stack: error.stack,
        tipo: error.name || 'Error'
      }
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));
    
    throw new Error(`Error al consultar SRI deudas: ${error.message}`)
  } finally {
    console.log('🔄 Cerrando navegador...')
    await browser.close()
  }
}