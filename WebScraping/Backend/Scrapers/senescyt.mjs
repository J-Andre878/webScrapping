import { chromium } from "playwright"
import Tesseract from 'tesseract.js'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

// Obtener directorio actual para ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Crear directorio para archivos de Tesseract (relativo al backend)
const tesseractDir = path.join(__dirname, "..", "utils", "tesseract")
if (!fs.existsSync(tesseractDir)) {
  fs.mkdirSync(tesseractDir, { recursive: true })
}

export const obtenerDatos = async (cedula) => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto("https://www.senescyt.gob.ec/consulta-titulos-web/faces/vista/consulta/consulta.xhtml", {
      waitUntil: "domcontentloaded"
    })

    let estado = ""
    let resultados = []
    
    while (true) {
      // Esperar a que cargue el captcha
      await page.waitForSelector('img[src*="Captcha.jpg"]');
    
      // Definir rutas de archivos dentro de la carpeta tesseract
      const captchaPath = path.join(tesseractDir, 'captcha.png')
      const processedPath = path.join(tesseractDir, 'captcha_processed.png')
      
      // Capturar el captcha en una imagen
      const captchaElement = await page.$('img[src*="Captcha.jpg"]');
      await captchaElement.screenshot({ path: captchaPath });
    
      // Preprocesar la imagen con sharp
      await sharp(captchaPath)
        .normalize()
        .grayscale()                  // convierte a blanco y negro
        .modulate({ brightness: 2, contrast: 1.5 })  // mejora visibilidad de caracteres
        .sharpen()  // resalta bordes   
        .threshold(50)           
        .resize(400, 100)                // agrandar si es muy pequeño
        .toFile(processedPath);
    
      // OCR con Tesseract - especificar la carpeta para los archivos de entrenamiento
      const { data: { text } } = await Tesseract.recognize(processedPath, 'eng', {
        cachePath: tesseractDir,  // Los archivos .traineddata se guardarán aquí
        langPath: tesseractDir    // Buscar archivos de idioma en esta carpeta
      });
    
      const captchaText = text.trim();
      console.log(`🔎 Captcha detectado: ${captchaText}`)
      
      // Limpiar campos antes de escribir (por si hay contenido previo)
      await page.fill("#formPrincipal\\:identificacion", "")
      await page.fill("#formPrincipal\\:captchaSellerInput", "")
      
      // Rellenamos el campo de cédula
      await page.type("#formPrincipal\\:identificacion", cedula) 
      // Rellenamos el campo de captcha
      await page.type("#formPrincipal\\:captchaSellerInput", captchaText) 
      //Se le da click al botón de buscar
      await page.click("#formPrincipal\\:boton-buscar")
      //Espera 2 segundos para que carge de nuevo la pagina
      await page.waitForTimeout(2000)
      
      // Espera hasta que aparezca la primera etiqueta que aparezca
      estado = await Promise.race([
        page.waitForSelector('.msg-rojo', { timeout: 60000 }).then(() => 'no_resultados'),
        page.waitForSelector("tbody[id$='tablaAplicaciones_data']", { timeout: 60000 }).then(() => 'ok'),
        page.waitForSelector(".ui-messages-error.ui-corner-all", { timeout: 60000 }).then(() => 'captcha_incorrecto'),
      ])

      if (estado === 'no_resultados') {
        console.log(`ℹ️ No hay títulos registrados para la cédula ${cedula}`)
        break
      } else if (estado === 'ok') {
        console.log(`✅ Captcha correcto, procesando resultados...`)
        break
      } else if (estado === 'captcha_incorrecto') {
        console.log(`❌ Captcha incorrecto, intentando de nuevo...`)
        // El bucle continuará para intentar con un nuevo captcha
      }
    }

    if (estado === 'ok') {
      //Recorro las filas de la tabla y obtengo los datos
      resultados = await page.$$eval("tbody[id$='tablaAplicaciones_data'] tr", (filas) => {
        return filas.map((fila) => {
          const columnas = fila.querySelectorAll("td")
          return {
            titulo: columnas[0]?.innerText.trim() || "",
            institucion: columnas[1]?.innerText.trim() || "",
            tipo: columnas[2]?.innerText.trim() || "",
            fechaRegistro: columnas[5]?.innerText.trim() || "",
            area: columnas[6]?.innerText.trim() || "",
          }
        })
      })

      console.log(`✅ Se encontraron ${resultados.length} títulos para la cédula ${cedula}`)
    }

    // Guardar en base de datos usando el modelo
    if (resultados.length > 0) {
      await DatabaseOperations.addToArrayNoDuplicates(
        Collections.SENESCYT,
        { cedula },
        'titulos',
        resultados,
        ['titulo', 'institucion', 'fechaRegistro']
      )
      console.log(`💾 Datos guardados en base de datos para la cédula ${cedula}`)
    }

    // Retornar datos para el controller
    return {
      cedula,
      titulos: resultados,
      totalTitulos: resultados.length,
      fechaConsulta: new Date(),
      estado: estado === 'ok' ? 'exitoso' : 'sin_datos'
    }
    
  } catch (error) {
    console.error("\n❌ Error en obtenerDatos:", error.message)
    
    // Guardar error en base de datos
    await ErrorLogsModel.saveError(
      'senescyt',
      cedula,
      'error_general',
      { 
        mensaje: error.message || 'Error al consultar SENESCYT',
        stack: error.stack,
        tipo: error.name || 'Error'
      }
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));
    
    throw new Error(`Error al consultar SENESCYT: ${error.message}`)
  } finally {
    await browser.close()
    
    // Limpiar archivos temporales de captcha
    try {
      const captchaPath = path.join(tesseractDir, 'captcha.png')
      const processedPath = path.join(tesseractDir, 'captcha_processed.png')
      
      if (fs.existsSync(captchaPath)) {
        fs.unlinkSync(captchaPath)
      }
      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath)
      }
    } catch (err) {
      console.warn('⚠️ No se pudieron limpiar archivos temporales:', err.message)
    }
  }
}