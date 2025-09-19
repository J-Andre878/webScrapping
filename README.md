# Web-Scrapping - Node.js + Playwright + React + MongoDB
Proyecto que realiza Web scrapping de páginas como la Senecyt, SUPA, Sercop, etc.

## 🛠️ Requisitos
- Node.js (versión +20.16.0)
- npm
- MongoDB
- Docker y Docker Compose
- xvfb, x11vnc, fluxbox (para VNC)
- wget, gi## 📋 Scrapers Disponibles

### Scrapers Automáticos (sin intervención manual)
- ✅ Citaciones ANT
- ✅ Citación Judicial  
- ✅ Consejo de la Judicatura
- ✅ **Consulta SRI** (Actualizado - ahora usa APIs directas)
- ✅ Impedimentos Cargos Públicos
- ✅ Pensión Alimenticia
- ✅ Senescyt
- ✅ Superintendencia de Compañías (SuperCías)
- ✅ Datos IESS

### Scrapers con Intervención Manual (requieren VNC)
- 🖱️ Procesos Judiciales  
- 🖱️ Antecedentes Penales
- 🖱️ Interpol
- �️ Deudas SRI

Los scrapers manuales abren una ventana VNC donde puedes interactuar directamente con el navegador.

> **🚀 Nuevo**: El scraper de **Consulta SRI** ahora usa las APIs oficiales del SRI, por lo que es mucho más rápido y no requiere intervención manual.

> **💡 Nota importante**: Este proyecto usa archivos `.env` para la configuración que **NO se incluyen en GitHub** por seguridad. Necesitarás crearlos basándote en los archivos `.env.example` que sí están incluidos.

### 1. Clonar el repositorio
```bash
git clone https://github.com/J-Andre878/webScrapping.git
cd webScrapping
```

### 2. Configurar variables de entorno

**⚠️ IMPORTANTE**: Los archivos `.env` NO se incluyen en el repositorio por seguridad. Debes crearlos basándote en los archivos `.env.example`.

#### 📁 Configuración principal (.env) - EN LA CARPETA RAÍZ
**Ubicación**: `/ruta/del/proyecto/webScrapping/.env` (carpeta raíz del proyecto)

```bash
# Asegúrate de estar en la carpeta raíz del proyecto
pwd  # Debe mostrar algo como: /home/usuario/webScrapping

# Crear el archivo principal
cp .env.example .env
nano .env
```

**¿Por qué copiar?** El archivo `.env` contiene tu IP real y configuración específica, por eso no se sube a GitHub. El `.env.example` es solo una plantilla.

Contenido del archivo `.env` (ajustar la IP por la de tu servidor):
```env
# IP del servidor (CAMBIAR POR TU IP)
SERVER_IP=192.168.95.207

# Puertos
FRONTEND_PORT=80
BACKEND_PORT=3001
MONGODB_PORT=27018
VNC_PORT=6080

# URLs para el frontend (se compilan automáticamente durante el build)
VITE_API_BASE_URL=http://192.168.95.207:3001
VITE_VNC_URL=http://192.168.95.207:6080

# MongoDB
MONGODB_DATABASE=webScraping
```

#### 📁 Configuración del Backend (.env) - EN LA CARPETA Backend
**Ubicación**: `/ruta/del/proyecto/webScrapping/WebScraping/Backend/.env`

```bash
# Cambiar a la carpeta Backend
cd WebScraping/Backend
pwd  # Debe mostrar algo como: /home/usuario/webScrapping/WebScraping/Backend

# Crear el archivo del backend
cp .env.example .env
nano .env
```

**Nota**: Este archivo también se crea porque contiene configuración específica de tu entorno.

Contenido de `WebScraping/Backend/.env`:
```env
# Para Docker Compose (recomendado)
MONGODB_URI=mongodb://mongodb:27017
DB_NAME=webScraping
PORT=3001

# Para desarrollo local (comentar las líneas de arriba y descomentar estas)
# MONGODB_URI=mongodb://localhost:27017
# DB_NAME=webScraping
# PORT=3001
```

## 📂 Estructura de archivos de configuración

Después de seguir los pasos anteriores, deberías tener esta estructura:

```
webScrapping/                          👈 CARPETA RAÍZ
├── .env                              ✅ CREAR ESTE (copiar de .env.example)
├── .env.example                      ✅ YA EXISTE (plantilla)
├── docker-compose.yml                
├── README.md                         
└── WebScraping/
    ├── Backend/                      👈 CARPETA BACKEND  
    │   ├── .env                      ✅ CREAR ESTE (copiar de .env.example)
    │   ├── .env.example              ✅ YA EXISTE (plantilla)
    │   ├── package.json              
    │   └── ...
    └── Frontend/
        └── ...
```

> **💡 Resumen**: Necesitas crear **2 archivos .env**:
> 1. Uno en la **raíz** (`webScrapping/.env`) 
> 2. Otro en **Backend** (`webScrapping/WebScraping/Backend/.env`)

#### ✅ Verificación rápida
Para confirmar que creaste los archivos en las ubicaciones correctas:
```bash
# Desde la carpeta raíz del proyecto
ls -la .env                           # Debe mostrar el archivo
ls -la WebScraping/Backend/.env       # Debe mostrar el archivo

# Si alguno no existe, repite los pasos de arriba
```

### 3. Instalar dependencias del sistema (Ubuntu)
```bash
sudo apt update
sudo apt install -y xvfb x11vnc fluxbox wget git
git clone https://github.com/novnc/noVNC.git
```
### 4. Configurar el servicio del Backend (systemd)

Crear el archivo del servicio:
```bash
sudo nano /etc/systemd/system/webscraping.service
```

Copiar y pegar el siguiente contenido, **ajustando las rutas según tu usuario**:

```ini
[Unit]
Description=Webscraping con Playwright + VNC + noVNC
After=network.target

[Service]
# AJUSTAR ESTA LÍNEA (cambiar por tu usuario)
User=andre

# AJUSTAR ESTA LÍNEA (cambiar por la ruta real de tu Backend)
WorkingDirectory=/home/andre/Practicas_Tikee/webScrapping/WebScraping/Backend

# AJUSTAR ESTA LÍNEA (cambiar por tu usuario)
Environment=HOME=/home/andre
Environment=DISPLAY=:99

ExecStart=/bin/bash -c '\
    Xvfb :99 -screen 0 1280x800x24 & \
    sleep 3 && \
    fluxbox -display :99 & \
    sleep 3 && \
    x11vnc -display :99 -auth $HOME/.Xauthority -nopw -listen 0.0.0.0 -forever -shared & \
    sleep 3 && \
    cd /home/TU_USUARIO/noVNC && ./utils/novnc_proxy --vnc localhost:5900 & \
    sleep 3 && \
    npm start \
'

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **⚠️ Importante**: Asegúrate de cambiar las siguientes rutas:
> - `User=andre` → `User=TU_USUARIO`
> - `/home/andre/` → `/home/TU_USUARIO/` (en todas las líneas)
> - `WorkingDirectory` → Ruta donde clonaste el proyecto
> - `cd /home/TU_USUARIO/noVNC` → Ruta donde clonaste noVNC

```

> **🔧 Opciones avanzadas de VNC**:
> 
> **Opción 1 (Recomendada)**: Display virtual con autenticación explícita
> ```bash
> x11vnc -display :99 -auth $HOME/.Xauthority -nopw -listen 0.0.0.0 -forever -shared
> ```
> 
> **Opción 2**: Usar display principal del sistema (si tienes problemas con la opción 1)
> ```bash
> x11vnc -display :0 -auth /var/run/lightdm/root/:0 -nopw -listen 0.0.0.0 -forever -shared
> ```
> 
> La **diferencia clave** es el parámetro `-auth` que especifica dónde encontrar el archivo de autorización X11, lo que hace las conexiones más estables.

Habilitar y configurar el servicio:
```bash
# Instalar dependencias del backend
cd WebScraping/Backend
npm install

# Configurar permisos 
sudo chown -R [TU_USUARIO]:[TU_USUARIO] /ruta/del/proyecto

# Habilitar el servicio
sudo systemctl daemon-reload
sudo systemctl enable webscraping.service
sudo systemctl start webscraping.service

# Ver logs del servicio
journalctl -u webscraping.service -f
```

### 5. Construir y ejecutar con Docker Compose

**Después de configurar las variables de entorno**, construir los contenedores:

```bash
# Volver a la raíz del proyecto
cd /ruta/del/proyecto

# Construir las imágenes (esto toma las variables del .env automáticamente)
docker-compose build

# Ejecutar todos los servicios
docker-compose up -d

# Verificar que estén funcionando
docker-compose ps
```

## 🚀 Acceso a la aplicación

Una vez todo configurado:

- **Frontend**: `http://TU_IP:80` (ejemplo: `http://192.168.95.207`)
- **Backend API**: `http://TU_IP:3001` (ejemplo: `http://192.168.95.207:3001`)
- **VNC (para scrapers manuales)**: `http://TU_IP:6080` (ejemplo: `http://192.168.95.207:6080`)
- **MongoDB**: `TU_IP:27018` (solo para conexiones directas)

## 🔧 Cómo funcionan las Variables de Entorno

### Frontend (React + Vite)
- Las variables `VITE_*` se **compilan durante el build** del Docker
- Se toman automáticamente del archivo `.env` principal
- **No se pueden cambiar después del build** - requiere reconstruir la imagen

### Backend (Node.js)
- Lee las variables de entorno en tiempo de ejecución
- Puede usar las del sistema o del archivo `.env` local

### Docker Compose
- Toma las variables del archivo `.env` de la raíz
- Las pasa como argumentos de build al frontend
- Las usa como variables de entorno para otros servicios

## 🔄 Comandos útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Reconstruir solo el frontend (si cambias variables de entorno)
docker-compose build frontend
docker-compose up -d frontend

# Parar todos los servicios
docker-compose down

# Parar y eliminar volúmenes (cuidado: borra la base de datos)
docker-compose down -v
```

## 📋 Scrapers Disponibles

### Scrapers Automáticos (sin intervención manual)
- ✅ **Citaciones ANT** (Actualizado - ahora usa APIs directas)
- ✅ **Citación Judicial** (Actualizado - ahora usa APIs JSF/AJAX)
- ✅ Consejo de la Judicatura
- ✅ **Consulta SRI** (Actualizado - ahora usa APIs directas)
- ✅ Impedimentos Cargos Públicos
- ✅ Pensión Alimenticia
- ✅ Senescyt
- ✅ Superintendencia de Compañías (SuperCías)
- ✅ Datos IESS

### Scrapers con Intervención Manual (requieren VNC)
- 🖱️ Procesos Judiciales  
- 🖱️ Antecedentes Penales
- 🖱️ Interpol
- 🖱️ Deudas SRI

Los scrapers manuales abren una ventana VNC donde puedes interactuar directamente con el navegador.

> **🚀 Actualizado**: Los scrapers de **Consulta SRI**, **Citaciones ANT** y **Citación Judicial** ahora usan las APIs oficiales/JSF, por lo que son mucho más rápidos y no requieren intervención manual.

## 🛠️ Troubleshooting

### Error: "SyntaxError: JSON.parse"
- **Causa**: Variables de entorno no configuradas correctamente
- **Solución**: Verificar que el archivo `.env` esté configurado y reconstruir el frontend:
  ```bash
  docker-compose build frontend
  docker-compose up -d frontend
  ```

### Frontend no carga o muestra errores 404
- Verificar que las URLs en `.env` coincidan con la IP del servidor
- Verificar que todos los servicios estén funcionando: `docker-compose ps`

### VNC no se conecta
- Verificar que el servicio systemd esté funcionando: `sudo systemctl status webscraping.service`
- Verificar que el puerto 6080 esté abierto y accesible

### Base de datos no se conecta
- Verificar que MongoDB esté funcionando: `docker-compose logs mongodb`
- Verificar la configuración de `MONGODB_URI` en el Backend

### Cambiar la IP del servidor
1. Editar el archivo `.env` con la nueva IP
2. Reconstruir el frontend: `docker-compose build frontend`
3. Reiniciar todos los servicios: `docker-compose up -d`

## 📝 Notas Importantes

- **Variables de entorno del frontend**: Se compilan durante el build de Docker. Si cambias la IP o puertos, debes reconstruir la imagen del frontend.
- **Persistencia de datos**: MongoDB usa un volumen Docker, los datos se mantienen entre reinicios.
- **Logs del sistema**: Los logs de los scrapers se guardan en la base de datos y son visibles desde la interfaz web.

---

## Configuración Legacy (OBSOLETA)

<details>
<summary>Configuración antigua - Solo para referencia</summary>

### Configuración de variable de entorno (LEGACY)
**NOTA**: Esta sección está obsoleta. Usa la configuración de Docker Compose de arriba.

En la carpeta Backend editar el archivo `.env` si es necesario  
Contenido actual:
```
MONGODB_URI=mongodb://localhost:27017
DB_NAME=webScraping  
PORT=3000
```

</details>
