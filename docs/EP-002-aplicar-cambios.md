# EP-002: aplicar y probar la conexión al backend

Base: HU-053 publicada en el commit `1dc2784`. Responsable: Silvana Díaz.

## 1. Copiar los cambios

Detén los servidores con Ctrl+C. Extrae `EP-002-cambios.zip` en una carpeta temporal.
Copia sus carpetas `backend`, `frontend` y `docs` dentro de:

`C:\Users\Asus\Documents\plataforma-5e-taller-integrador`

Combina las carpetas y reemplaza los archivos del paquete. No reemplaces la carpeta completa del repositorio: el ZIP contiene únicamente los cambios de EP-002. Conserva tu base de datos y tus capturas.

## 2. Iniciar el backend (terminal 1)

En PowerShell:

```powershell
cd "C:\Users\Asus\Documents\plataforma-5e-taller-integrador\backend"
if (-not (Test-Path ".venv")) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
$env:DATABASE_URL = "sqlite:///./demo.db"
.\.venv\Scripts\python.exe -m uvicorn plataforma5e.bootstrap.app:crear_aplicacion --factory --host 127.0.0.1 --port 8000
```

Deja esta terminal abierta. La dependencia nueva es `python-multipart`; se instala con el comando anterior. Las tablas EP-002 se crean automáticamente. `demo.db` conserva los datos entre reinicios. La configuración anterior utiliza SQLite, que es la base comprobada para esta entrega.

Swagger: http://127.0.0.1:8000/docs

## 3. Iniciar el frontend (terminal 2)

```powershell
cd "C:\Users\Asus\Documents\plataforma-5e-taller-integrador\frontend"
npm install
npm run dev
```

Abre la dirección que muestra Vite (normalmente http://localhost:5173/login).
En **Modo de acceso**, selecciona **Backend conectado (EP-002)**.

- Correo: `docente@5e.demo`
- Contraseña: `Demo5E!2026`

El otro modo conserva el prototipo local HU-045. Los catálogos y decisiones del navegador se guardan por separado para evitar perder el trabajo local al probar EP-002.

## 4. Recorrido y capturas manuales

1. **/login:** muestra el modo conectado y prueba primero una contraseña incorrecta; luego inicia sesión con las credenciales de demostración.
2. **/cursos:** crea un curso con código `PRUEBA-EP002`, nombre y periodo; añade dos unidades con títulos. Edita el curso para comprobar que se conservan sus unidades.
3. **/carga:** selecciona una de esas unidades, elige un TXT UTF-8 con contenido, selecciona el tipo y confirma el permiso de uso. Pulsa **Guardar archivo en el servidor**. Captura el documento registrado y usa **Descargar archivo** para comparar su contenido.
4. **/chat:** utiliza el curso preparado para la demo de generación. Envía:

   `Necesito una actividad del curso ICSI-205 unidad 2; Público: estudiantes de tercer ciclo; Competencia: pensamiento crítico; Modalidad: Textual; Cantidad: 1; Etapa: Explore`

   Revisa la interpretación, corrige un dato y pulsa **Confirmar y continuar a configuración**. Captura el resumen editable.
5. **/configuracion:** verifica el contexto transferido. Pulsa **Solicitar propuestas a la API**, revisa el cuadro **Confirmar solicitud** y pulsa **Confirmar y solicitar**. Captura la confirmación y la tabla **Solicitudes recientes**, con los parámetros guardados.
6. **Persistencia:** cierra sesión, vuelve a entrar en modo conectado y comprueba el curso, documento e historial. Reinicia el backend con la misma base de datos y repite. No se debe borrar `demo.db`.
7. **Errores:** con el backend detenido, intenta guardar un curso. Debe aparecer el error de conexión y el curso no debe crearse localmente. Reinicia el backend y reintenta.

Guarda tus capturas en `docs/evidencias/EP-002/` y adjúntalas a la tarjeta. No se incluyen capturas automáticas nuevas en este paquete.

Las unidades nuevas aceptan material sin RA si todavía no tienen resultados de aprendizaje. En las unidades que ya tienen RA, debes seleccionar al menos uno. La creación o edición de RA no se incorpora en esta entrega.

**La carga real no ejecuta extracción ni RAG.** El archivo queda registrado y descargable, con cero fragmentos. Para la generación de demostración utiliza ICSI-205, unidad 2, Explore / Guía de exploración o Evaluate / Ítem de opción múltiple. Un curso recién creado no tiene ejemplos preparados y recibirá un rechazo claro de generación.

## 5. Ver GET en Swagger

En http://127.0.0.1:8000/docs:

1. Abre `POST /api/v1/sesiones`, pulsa **Try it out**, introduce el correo y contraseña de demostración y pulsa **Execute**.
2. Copia solamente el valor del campo `token` de la respuesta, sin comillas.
3. Pulsa el botón **Authorize** con el candado en la parte superior de Swagger.
4. En el campo **Value** de **SesionDocente**, pega **solo el token**. No escribas `Bearer`: Swagger lo añade automáticamente. Pulsa **Authorize** y luego **Close**.
5. Abre `GET /api/v1/solicitudes`, pulsa **Try it out** y **Execute**. La respuesta 200 muestra el historial y sus parámetros. Si devuelve `[]`, todavía no hay solicitudes exitosas asociadas a esa cuenta: genera una desde el frontend en modo conectado y vuelve a ejecutar GET.
6. Para recuperar una respuesta completa, copia el `id` de una solicitud y úsalo en `GET /api/v1/generaciones/{generacion_id}`. Swagger enviará la misma autorización.
7. Al cerrar sesión en la interfaz se revoca solamente su token. La sesión iniciada por Swagger tiene otro token; ciérrala usando `DELETE /api/v1/sesiones/actual`. El botón **Logout** de Swagger solo quita el token de la interfaz de documentación.

Si no aparece **Authorize**, reinicia el backend actualizado y recarga Swagger con **Ctrl+F5**. El campo manual `authorization` de la versión anterior fue reemplazado por el esquema Bearer que Swagger reconoce.

También puedes ver GET y POST en F12 → Red / Network del navegador. No publiques capturas del token de una sesión activa.

## 6. Pruebas en tu computadora

Detén ambos servidores antes de las pruebas automatizadas de navegador: las pruebas levantan sus propios servidores en 5174 y 8000.

Backend, en una terminal:

```powershell
cd "C:\Users\Asus\Documents\plataforma-5e-taller-integrador\backend"
.\.venv\Scripts\python.exe -m pytest tests -q
```

Frontend, en la otra:

```powershell
cd "C:\Users\Asus\Documents\plataforma-5e-taller-integrador\frontend"
npm run build
npm test
npx playwright install chromium
npm run test:e2e
$env:HU053_PYTHON = "C:\Users\Asus\Documents\plataforma-5e-taller-integrador\backend\.venv\Scripts\python.exe"
npm run test:api:e2e
```

`HU053_PYTHON` conserva el nombre de la variable de la configuración anterior; ahora permite ejecutar también las pruebas EP-002. Las pruebas de API utilizan SQLite temporal, no `demo.db`.

## 7. Commit después de comprobar el recorrido

Hazlo una sola vez, en una terminal ubicada en la raíz del repositorio:

```powershell
cd "C:\Users\Asus\Documents\plataforma-5e-taller-integrador"
git status
git add backend frontend docs
git restore --staged frontend/tsconfig.tsbuildinfo
git diff --cached --stat
```

Comprueba que no haya `.venv`, `node_modules`, bases `.db`, archivos `.env`, resultados de pruebas ni tokens entre los archivos preparados. Después:

```powershell
git commit -m "feat(EP-002): conectar sesión, cursos, material e historial al backend"
git push origin main
```

La aprobación académica y la validación con docentes quedan pendientes hasta realizarlas y registrar las evidencias. EP-002 agrupa el módulo; esta integración no cierra automáticamente todas las historias que pertenezcan a la épica.
