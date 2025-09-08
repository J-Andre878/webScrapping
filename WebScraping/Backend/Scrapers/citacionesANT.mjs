import { chromium } from "playwright"
// Corregir la ruta de importación (Models con M mayúscula)
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

export const obtenerCitaciones = async (cedula) => {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  })
  const page = await browser.newPage()

  // Configurar user agent y viewport
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  await page.setViewportSize({ width: 1280, height: 720 })

  try {
    await page.goto("https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_criterio_consulta.jsp", {
      waitUntil: "networkidle",
      timeout: 30000
    })

    // Esperar a que la página esté completamente cargada
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    // Rellenamos el campo de cedula
    await page.type("#ps_identificacion", cedula)
    // Se le da click al botón de buscar
    await page.click('a[href="javascript:validar();"]')

    // Esperar más tiempo para que JavaScript procese
    await page.waitForTimeout(5000)

    //Espera hasta que se ingresen la cedula y le de clik, ahí aparece el div con el id div_estado_cuenta
    await page.waitForSelector("#div_estado_cuenta", { timeout: 60000 })

    //Espera 2 segundos para que se cargue la tabla de citaciones pendientes
    await page.waitForTimeout(2000)

    //Recorro las filas de la tabla de citaciones pendientes y obtengo los datos   
    const citacionesPendientes = await page.$$eval("#list10 tbody", (tabla) => {
      const filas = Array.from(tabla[0].querySelectorAll("tr"))
      return filas.slice(1).map((fila) => {
        const columnas = fila.querySelectorAll("td")
        return {
          id: columnas[0]?.innerText.trim() || "",
          infraccion: columnas[2]?.innerText.trim() || "",
          entidad: columnas[3]?.innerText.trim() || "",
          citacion: columnas[4]?.innerText.trim() || "",
          placa: columnas[5]?.innerText.trim() || "",
          fechaEmision: columnas[7]?.innerText.trim() || "",
          fechaNotificacion: columnas[8]?.innerText.trim() || "",
          puntos: columnas[10]?.innerText.trim() || "",
          sancion: columnas[14]?.innerText.trim() || "",
          multa: columnas[15]?.innerText.trim() || "",
          remision: columnas[16]?.innerText.trim() || "",
          totalPagar: columnas[17]?.innerText.trim() || "",
          articulo: columnas[18]?.innerText.trim() || "",
        }
      })
    })

    //Le doy click al botón de "Pagadas" para cambiar la tabla
    await page.evaluate(() => {
      const divs = document.querySelectorAll("div")

      for (const div of divs) {
        const font = div.querySelector("font")
        const input = div.querySelector("input[type='radio']")

        // Verifica que el texto del <font> diga "Pagadas"
        if (font && input && font.innerText.trim().startsWith("Pagadas")) {
          input.click()
          break
        }
      }
    })

    //Espera 1 segundo para que se cargue la tabla de citaciones pagadas
    await page.waitForTimeout(1000)

    //Recorro las filas de la tabla de citaciones pagadas y obtengo los datos
    const citacionesPagadas = await page.$$eval("#list10 tbody", (tabla) => {
      const filas = Array.from(tabla[0].querySelectorAll("tr"))
      return filas.slice(1).map((fila) => {
        const columnas = fila.querySelectorAll("td")
        return {
          id: columnas[0]?.innerText.trim() || "",
          infraccion: columnas[2]?.innerText.trim() || "",
          entidad: columnas[3]?.innerText.trim() || "",
          citacion: columnas[4]?.innerText.trim() || "",
          placa: columnas[5]?.innerText.trim() || "",
          fechaEmision: columnas[7]?.innerText.trim() || "",
          fechaNotificacion: columnas[8]?.innerText.trim() || "",
          puntos: columnas[10]?.innerText.trim() || "",
          sancion: columnas[14]?.innerText.trim() || "",
          multa: columnas[15]?.innerText.trim() || "",
          remision: columnas[16]?.innerText.trim() || "",
          totalPagar: columnas[17]?.innerText.trim() || "",
          articulo: columnas[18]?.innerText.trim() || "",
        }
      })
    })

    console.log(`✅ Se encontraron ${citacionesPendientes.length} citaciones pendientes y ${citacionesPagadas.length} citaciones pagadas para la cédula ${cedula}`)

    // Verificar si se encontraron datos
    if (citacionesPendientes.length === 0 && citacionesPagadas.length === 0) {
      console.log(`ℹ️ No se encontraron citaciones ANT para la cédula ${cedula}.`)
      return {
        cedula,
        citacionesPendientes: [],
        citacionesPagadas: [],
        totalCitaciones: 0,
        fechaConsulta: new Date(),
        estado: 'sin_datos'
      }
    }

    // Guardar citaciones pendientes
    if (citacionesPendientes.length > 0) {
      await DatabaseOperations.addToArrayNoDuplicates(
        Collections.CITACIONES_ANT,
        { cedula },
        'citacionesPendientes',
        citacionesPendientes,
        ['id', 'citacion', 'placa']
      )
    }

    // Guardar citaciones pagadas
    if (citacionesPagadas.length > 0) {
      await DatabaseOperations.addToArrayNoDuplicates(
        Collections.CITACIONES_ANT,
        { cedula },
        'citacionesPagadas',
        citacionesPagadas,
        ['id', 'citacion', 'placa']
      )
    }

    console.log(`💾 Datos guardados en base de datos para la cédula ${cedula}`)

    // Retornar datos para el controller
    return {
      cedula,
      citacionesPendientes,
      citacionesPagadas,
      totalCitaciones: citacionesPendientes.length + citacionesPagadas.length,
      fechaConsulta: new Date(),
      estado: 'exitoso'
    }

  } catch (error) {
    console.error("\n❌ Error en obtenerCitaciones:", error.message)
    
    // Guardar error en base de datos
    await ErrorLogsModel.saveError(
      'citaciones-ant',
      cedula,
      'error_general',
      { 
        mensaje: error.message || 'Error al consultar citaciones ANT',
        stack: error.stack,
        tipo: error.name || 'Error'
      }
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));
    
    throw new Error(`Error al consultar citaciones ANT: ${error.message}`)
  } finally {
    await browser.close()
  }
}