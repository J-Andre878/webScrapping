import { chromium } from "playwright"
import Tesseract from 'tesseract.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Obtener directorio actual para ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Crear directorio para archivos de Tesseract (relativo al backend)
const tesseractDir = path.join(__dirname, "..", "utils", "tesseract")
if (!fs.existsSync(tesseractDir)) {
  fs.mkdirSync(tesseractDir, { recursive: true })
}

export const datosIESS = async (cedula) => {
    const browser = await chromium.launch({ headless: false })
    const page = await browser.newPage()

    try {
        await page.goto("https://app.iess.gob.ec/gestion-calificacion-derecho-web/public/formulariosContacto.jsf", {
        waitUntil: "domcontentloaded"
        })

        // Rellenamos el campo de cedula
        await page.type("#formConsulta\\:cedula_text", cedula)

        // Se le da click al boton de fecha
        await page.click('.ui-datepicker-trigger')
        // Se selecciona la fecha actual
        await page.click('.ui-datepicker-days-cell-over.ui-datepicker-today')

        //Se selecciona la opcion ENFERMEDAD que tiene el valor "14"
        // 1. Click al menú desplegable visible
        await page.click('#formConsulta\\:contingencia_select .ui-selectonemenu-label');

        // 2. Click a la opción "Enfermedad"
        const botonSelect = await page.$("li[data-label='Enfermedad']")
        await botonSelect.hover()
        await page.waitForTimeout(500)
        await botonSelect.click()

        let estado = null;
        while (estado !== "ok") {

            // Se le da click al boton ACEPTAR
            const boton = await page.$("#formConsulta\\:j_idt40");
            await boton.hover();
            await page.waitForTimeout(500);
            await boton.click();

            await page.waitForTimeout(2000);

            const etiquetaBoton = await page.$('#formConsulta\\:j_idt40');
            if (etiquetaBoton) {
                estado = "sinCambios";  // No encontrado, seguimos
            } else {
                estado = "ok";  // Encontrado, salimos del bucle
            }

        }

        // Definir rutas de archivos dentro de la carpeta tesseract
        const screenshotPath = path.join(tesseractDir, 'resultado_iess.png')

        // Tomar captura de pantalla para OCR
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        console.log('📸 Captura tomada, procesando con OCR...');
        
        // Procesar la imagen con Tesseract OCR - usar la misma configuración que SENESCYT
        const { data: { text } } = await Tesseract.recognize(screenshotPath, 'spa', {
            cachePath: tesseractDir,  // Los archivos .traineddata se guardarán aquí
            langPath: tesseractDir,   // Buscar archivos de idioma en esta carpeta
            logger: m => console.log(m)
        });
        
        console.log('📝 Texto extraído por OCR:', text);
        
        // Extraer datos específicos del texto OCR
        const datosExtraidos = extraerDatosOCR(text, cedula);
        
        // Verificar si la cédula no está registrada en el IESS
        if (datosExtraidos.detalle && datosExtraidos.detalle.includes("Cédula No se Encuentra Registrada en el IESS")) {
            console.log('⚠️ Cédula no registrada en IESS:', cedula);
            await browser.close()
            return {
                error: 'cedula_no_registrada',
                mensaje: 'Cédula No se Encuentra Registrada en el IESS.',
                cedula,
                fechaConsulta: new Date()
            }
        }

        const datos = {
            cobertura: datosExtraidos.cobertura,
            tipoAfiliacion: datosExtraidos.tipoAfiliacion,
            detalle: datosExtraidos.detalle,
            cedula,
            fechaConsulta: new Date()
        };

        console.log('✅ Datos IESS obtenidos exitosamente:', datos);
        await browser.close()
        
        // Limpiar archivo temporal de captura
        try {
            if (fs.existsSync(screenshotPath)) {
                fs.unlinkSync(screenshotPath)
                console.log('🧹 Archivo temporal limpiado')
            }
        } catch (err) {
            console.warn('⚠️ No se pudo limpiar archivo temporal:', err.message)
        }
        
        return datos

    } catch (error) {
        console.error("❌ Error al obtener datos IESS:", error)
        await browser.close()
        
        // Limpiar archivo temporal en caso de error
        try {
            const screenshotPath = path.join(tesseractDir, 'resultado_iess.png')
            if (fs.existsSync(screenshotPath)) {
                fs.unlinkSync(screenshotPath)
            }
        } catch (err) {
            console.warn('⚠️ No se pudo limpiar archivo temporal:', err.message)
        }
        
        return {
            error: error.message || 'Error al procesar la consulta IESS',
            cedula,
            fechaConsulta: new Date()
        }
    }
}

// Función para extraer datos específicos del texto OCR
function extraerDatosOCR(texto, cedula) {
    console.log('🔍 Extrayendo datos del texto OCR...');
    
    // Limpiar y normalizar el texto
    const textoLimpio = texto.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    let cobertura = '';
    let tipoAfiliacion = '';
    let detalle = '';
    
    // Extraer cobertura (buscar "SIN COBERTURA IESS" o "CON COBERTURA IESS")
    if (textoLimpio.includes('SIN COBERTURA IESS')) {
        cobertura = 'SIN COBERTURA IESS';
    } else if (textoLimpio.includes('CON COBERTURA IESS')) {
        cobertura = 'CON COBERTURA IESS';
    } else {
        // Buscar patrones alternativos
        const coberturaMatch = textoLimpio.match(/(SIN|CON)\s+COBERTURA\s+IESS/i);
        if (coberturaMatch) {
            cobertura = coberturaMatch[0].toUpperCase();
        }
    }
    
    // Extraer tipo de afiliación (buscar después de "Tipo de Afiliación:")
    const tipoAfiliacionMatch = textoLimpio.match(/Tipo\s+de\s+Afiliaci[oó]n:\s*([^.]+?)(?:\.|$|Observaci[oó]n)/i);
    if (tipoAfiliacionMatch) {
        tipoAfiliacion = tipoAfiliacionMatch[1].trim();
    }
    
    // Extraer detalle/observación (buscar después de "Observación:")
    const detalleMatch = textoLimpio.match(/Observaci[oó]n:\s*([^.]+?)(?:\.|$)/i);
    if (detalleMatch) {
        detalle = detalleMatch[1].trim();
    }
    
    // Verificar si la cédula no está registrada
    if (textoLimpio.includes('Cédula No se Encuentra Registrada en el IESS') || 
        textoLimpio.includes('Cedula No se Encuentra Registrada en el IESS')) {
        detalle = 'Cédula No se Encuentra Registrada en el IESS';
    }
    
    console.log('📊 Datos extraídos:', {
        cobertura,
        tipoAfiliacion,
        detalle
    });
    
    return {
        cobertura: cobertura || 'No determinado',
        tipoAfiliacion: tipoAfiliacion || 'No determinado',
        detalle: detalle || 'No determinado'
    };
}