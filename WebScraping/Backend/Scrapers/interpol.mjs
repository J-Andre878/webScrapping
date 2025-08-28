import { chromium } from "playwright";
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js';

export const obtenerDatosInterpol = async (nombre, apellido = '') => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ],
    ...(process.platform === 'linux' && {
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0'
      }
    })
  });
  const page = await browser.newPage();

  try {
    await page.goto(
      "https://www.interpol.int/es/Como-trabajamos/Notificaciones/Notificaciones-rojas/Ver-las-notificaciones-rojas",
      { waitUntil: "domcontentloaded" }
    );

    await page.waitForSelector("#forename");
    await page.type("#forename", nombre);
    await page.type("#name", apellido);
    await page.click("#submit");

    // Esperar a que aparezca el elemento de resultados o mensaje de sin resultados
    await page.waitForTimeout(1000);

    // Verificar si no hay resultados - el elemento #noSearchResults aparece cuando no hay resultados
    const noResults = await page.evaluate(() => {
      const noResultsElement = document.querySelector("#noSearchResults");
      if (noResultsElement) {
        // Si existe el elemento #noSearchResults, verificamos si está visible
        const style = window.getComputedStyle(noResultsElement);
        const isVisible = style.display !== "none" && !noResultsElement.classList.contains("hidden");
        return isVisible;
      }
      return false;
    });

    if (noResults) {
      // Preparar los datos para guardar en la base de datos (sin resultados)
      const claveBusqueda = `${nombre.trim()} ${apellido.trim()}`.trim();
      const cantidadResultados = 0;
      const homonimo = false;
      const fechaConsulta = new Date();
      
      // Datos para la base de datos (SIN avisos)
      const datosBaseDatos = {
        clave: claveBusqueda,
        cantidadResultados,
        homonimo,
        fechaConsulta
      };

      // Guardar en la base de datos
      try {
        await DatabaseOperations.upsert(
          Collections.INTERPOL,
          { clave: claveBusqueda },
          datosBaseDatos
        );
        console.log(`💾 Datos básicos guardados en BD - Sin resultados`);
      } catch (dbError) {
        console.error("Error guardando en la base de datos:", dbError);
      }

      // Retornar para la interfaz (CON avisos vacíos)
      return {
        clave: claveBusqueda,
        cantidadResultados,
        homonimo,
        fechaConsulta,
        avisos: []
      };
    }

    const vistos = new Set();
    const avisosTotales = [];

    async function leerAvisosVisibles() {
      const locator = page.locator(".redNoticesList__item.notice_red");
      const cuenta = await locator.count();
      const lista = [];

      for (let i = 0; i < cuenta; i++) {
        const item = locator.nth(i);
        if (!(await item.isVisible())) continue;

        const nombreTexto = await item.locator(".redNoticeItem__labelLink").innerText().catch(() => null);
        const edad = await item.locator(".ageCount").innerText().catch(() => null);
        const nacionalidad = await item.locator(".nationalities").innerText().catch(() => null);

        const obj = {
          nombre: nombreTexto ? nombreTexto.trim().replace(/\n/g, " ") : null,
          edad: edad ? edad.trim() : null,
          nacionalidad: nacionalidad ? nacionalidad.trim() : null,
          fuente: "interpol"
        };

        const clave = `${obj.nombre}||${obj.nacionalidad}||${obj.edad}`;
        if (!vistos.has(clave)) {
          vistos.add(clave);
          lista.push(obj);
        }
      }

      return lista;
    }

    async function primerNombreVisibleActual() {
      return await page
        .$$eval(".redNoticesList__item.notice_red", (els) => {
          const visibles = els.filter((el) => {
            const s = window.getComputedStyle(el);
            return s && s.display !== "none" && el.offsetParent !== null && el.getBoundingClientRect().height > 0;
          });
          if (visibles.length === 0) return null;
          const first = visibles[0].querySelector(".redNoticeItem__labelLink");
          return first ? first.innerText.trim() : null;
        })
        .catch(() => null);
    }

    async function tieneBotonSiguiente() {
      try {
        const paginationExists = await page.locator("#paginationPanel").count() > 0;
        if (!paginationExists) {
          return false;
        }

        const nextButton = page.locator("#paginationPanel > div > div > ul > li.nextElement").first();
        const exists = await nextButton.count() > 0;
        if (!exists) {
          return false;
        }

        const isVisible = await nextButton.isVisible().catch(() => false);
        const classAttr = await nextButton.getAttribute("class").catch(() => "");
        const isHidden = classAttr.includes("hidden");

        return isVisible && !isHidden;
      } catch (error) {
        return false;
      }
    }

    await page.waitForSelector(".redNoticesList__item.notice_red", { timeout: 15000 }).catch(() => {});

    let paginaIndex = 1;
    let avisosPagina = await leerAvisosVisibles();
    avisosTotales.push(...avisosPagina);

    console.log(`📄 Página ${paginaIndex}: ${avisosPagina.length} avisos encontrados`);

    while (await tieneBotonSiguiente()) {
      const li = page.locator("#paginationPanel > div > div > ul > li.nextElement").first();
      const nombreAntes = await primerNombreVisibleActual();
      
      await li.locator("a").click().catch(() => {});

      const inicio = Date.now();
      let cambio = false;

      while (Date.now() - inicio < 10000) {
        await page.waitForTimeout(200);
        const nuevo = await primerNombreVisibleActual();

        if (nombreAntes == null) {
          if (nuevo) {
            cambio = true;
            break;
          }
        } else if (nuevo && nuevo !== nombreAntes) {
          cambio = true;
          break;
        }
      }

      if (!cambio) {
        break;
      }

      paginaIndex++;
      await page.waitForSelector(".redNoticesList__item.notice_red", { timeout: 10000 }).catch(() => {});

      avisosPagina = await leerAvisosVisibles();
      
      if (avisosPagina.length === 0) {
        break;
      }

      avisosTotales.push(...avisosPagina);

      if (paginaIndex >= 50) {
        console.log("Límite de páginas alcanzado");
        break;
      }
    }

    // Preparar los datos básicos
    const claveBusqueda = `${nombre.trim()} ${apellido.trim()}`.trim();
    const cantidadResultados = avisosTotales.length;
    const homonimo = cantidadResultados > 0;
    const fechaConsulta = new Date();

    console.log(`📊 Resumen consulta: ${claveBusqueda} - ${cantidadResultados} resultados - Homónimo: ${homonimo}`);

    // Datos para la base de datos (SIN avisos - solo datos básicos)
    const datosBaseDatos = {
      clave: claveBusqueda,
      cantidadResultados,
      homonimo,
      fechaConsulta
    };

    // Guardar en la base de datos (actualizar si ya existe) - SIN avisos
    try {
      await DatabaseOperations.upsert(
        Collections.INTERPOL,
        { clave: claveBusqueda }, // Filtro para buscar documento existente
        datosBaseDatos // Solo datos básicos, SIN avisos
      );
      console.log(`💾 Datos básicos guardados en BD - Con resultados: ${cantidadResultados}`);
    } catch (dbError) {
      console.error("Error guardando en la base de datos:", dbError);
      // No lanzamos el error para no interrumpir el scraping exitoso
    }

    // Retornar los datos COMPLETOS para la interfaz (CON avisos)
    return {
      clave: claveBusqueda,
      cantidadResultados,
      homonimo,
      fechaConsulta,
      avisos: avisosTotales // Solo se envía a la interfaz, NO se guarda en BD
    };

  } catch (err) {
    console.error("Error en el scraping Interpol:", err);
    
    // Preparar clave de búsqueda para el log de error
    const claveBusqueda = `${nombre.trim()} ${apellido.trim()}`.trim();
    
    // Guardar error en base de datos
    await ErrorLogsModel.saveError(
      'interpol',
      claveBusqueda,  // Usamos la clave de búsqueda como identificador
      'error_general',
      { 
        mensaje: err.message || 'Error en el scraping Interpol',
        stack: err.stack,
        tipo: err.name || 'Error',
        nombre: nombre,
        apellido: apellido
      }
    ).catch(dbErr => console.warn('⚠️ Error guardando log:', dbErr.message));
    
    throw err;
  } finally {
    console.log("🔄 Cerrando navegador...");
    await browser.close();
  }
};