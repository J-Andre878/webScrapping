# Web-Scrapping - Node.js + Plauywright + React + MongoDB
Proyecto que realiza Web scrapping de paginas como la senecyt, SUPA, Sercop, etc.

## Requisitos
-Node.js (version +20.16.0)
-npm
-MongoDB
-xvfb
-x11vnc
-wget
-fluxbox
-git

## Instalación
1. Clonar el repositorio de github: https://github.com/J-Andre878/webScrapping.git
E instalar dependencias del backend
cd /webScrapping/WebScraping/Backend
npm install


2. Instalar dependecias necesarias en el servidor de Ubuntu
'''
sudo apt update
sudo apt install -y xvfb x11vnc fluxbox wget git
git clone https://github.com/novnc/noVNC.git
'''
3. Crear el archivo para que funcione el servicio del backend
sudo nano /etc/systemd/system/webscraping.service

Y pegar el siguiente codigo, ajustando las rutas

[Unit]
Description=Webscraping con Playwright + VNC + noVNC
After=network.target

[Service]
# AJUSTAR ESTA LÍNEA (cambiar por su usuario)
User=andre

# AJUSTAR ESTA LÍNEA (cambiar por la ruta real de su Backend)
WorkingDirectory=/home/andre/Practicas_Tikee/webScrapping/WebScraping/Backend

# AJUSTAR ESTA LÍNEA (cambiar por su usuario)
Environment=HOME=/home/andre
Environment=DISPLAY=:99

ExecStart=/bin/bash -c '\
    Xvfb :99 -screen 0 1280x800x24 & \
    sleep 3 && \
    fluxbox -display :99 & \
    sleep 3 && \
    x11vnc -display :99 -nopw -listen 0.0.0.0 -forever -shared & \
    sleep 3 && \
    cd /home/andre/noVNC && ./utils/novnc_proxy --vnc localhost:5900 & \
    sleep 3 && \
    npm start \
'

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target


4. Habilitar el servicio
sudo systemctl daemon-reload
sudo systemctl enable webscraping.service
sudo systemctl restart webscraping.service

Para ver logs:
journalctl -u webscraping.service -f

5. Construir el docker del frontend
ruta: raiz del proyecto (WebScraping)
docker-compose build
docker-compose up -d



## Configuracion de variable de entorno
En la carpeta Backend editar el archivo `.env` si es necesario
Contenido actual:
MONGODB_URI=mongodb://localhost:27017
DB_NAME=webScraping
PORT=3000

##Scraper disponibles sin ventana emergente
  -Citaciones ANT
  -Citacion juficial
  -Consejo de la Judicatura
  -Impedimentos cargos públicos
  -Pensión Alimenticia
  -Senescyt
  -Superintendencias de Compañias (superCias)
  -Datos IESS

##Scraper disponibles con ventana emergente
  
  -Consulta SRI
  -Procesos Judiciales
  -Antecedentes Penales
  -Interpol
  -Deudas SRI
