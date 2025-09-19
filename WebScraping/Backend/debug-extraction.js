// Debug específico para la función extraerDatos
import './Scrapers/pensionAlimenticia.mjs';

async function debugExtractionFunction() {
  console.log('=== DEBUG FUNCIÓN EXTRAER DATOS ===');
  
  // Obtener datos de sesión
  const response1 = await fetch('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf');
  const html = await response1.text();
  
  const viewStateMatch = html.match(/name="javax\.faces\.ViewState".*?value="([^"]+)"/s);
  const viewState = viewStateMatch[1];
  const setCookieHeader = response1.headers.get('set-cookie') || '';
  const jsessionidMatch = setCookieHeader.match(/JSESSIONID=([^;]+)/);
  const jsessionid = jsessionidMatch ? jsessionidMatch[1] : null;
  
  // Hacer POST con JSESSIONID
  let postUrl = 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf';
  if (jsessionid) {
    postUrl += `;jsessionid=${jsessionid}`;
  }
  
  const formData = new URLSearchParams();
  formData.append('javax.faces.partial.ajax', 'true');
  formData.append('javax.faces.source', 'form:b_buscar_cedula');
  formData.append('javax.faces.partial.execute', '@all');
  formData.append('javax.faces.partial.render', 'form:pResultado panelMensajes form:pFiltro');
  formData.append('form:b_buscar_cedula', 'form:b_buscar_cedula');
  formData.append('form', 'form');
  formData.append('form:t_texto_cedula', '0706151594');
  formData.append('form:s_criterio_busqueda', 'Seleccione...');
  formData.append('form:t_texto', '');
  formData.append('javax.faces.ViewState', viewState);
  
  const response2 = await fetch(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/xml, text/xml, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Faces-Request': 'partial/ajax',
      'Origin': 'https://supa.funcionjudicial.gob.ec',
      'Referer': 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf',
      'Cookie': setCookieHeader
    },
    body: formData.toString()
  });
  
  const responseText = await response2.text();
  console.log('Response length:', responseText.length);
  
  // Extraer CDATA
  const cdataMatch = responseText.match(/<update id="form:pResultado"><!\[CDATA\[(.*?)\]\]><\/update>/s);
  if (!cdataMatch) {
    console.log('❌ No se encontró CDATA');
    return;
  }
  
  const tableContent = cdataMatch[1];
  console.log('CDATA length:', tableContent.length);
  
  // Verificar si contiene "No se encuentra resultados"
  if (tableContent.includes('No se encuentra resultados.')) {
    console.log('❌ Contiene "No se encuentra resultados."');
    
    // Verificar también si contiene "ui-datatable-empty-message"
    if (tableContent.includes('ui-datatable-empty-message')) {
      console.log('❌ También contiene "ui-datatable-empty-message"');
    }
    
  } else {
    console.log('✅ NO contiene "No se encuentra resultados."');
    
    // Buscar filas con data-ri
    const rowPattern = /<tr[^>]*data-ri="\d+"[^>]*class="[^"]*ui-widget-content[^"]*"[^>]*>(.*?)<\/tr>/gs;
    const matches = [...tableContent.matchAll(rowPattern)];
    console.log(`Filas con data-ri encontradas: ${matches.length}`);
    
    if (matches.length > 0) {
      console.log('✅ Sí hay filas con data-ri, la función extraerDatos debería funcionar');
      console.log('Primera fila content (500 chars):', matches[0][1].substring(0, 500));
    } else {
      console.log('❌ No hay filas con data-ri, hay un problema en el patrón');
    }
  }
  
  // Mostrar contenido completo para análisis
  console.log('\n=== CONTENIDO COMPLETO TABLA (primeros 2000 chars) ===');
  console.log(tableContent.substring(0, 2000));
}

debugExtractionFunction().catch(console.error);
