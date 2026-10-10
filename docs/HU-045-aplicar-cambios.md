# Aplicar y demostrar HU-045

El ZIP contiene solamente archivos nuevos o modificados de frontend/ y docs/. No contiene .git, contraseñas, dependencias ni archivos del backend. No fue subido a GitHub. Base utilizada: d1085c5f2b2523f76c1c47bdde49d3bb41e277bc.

1. En tu computadora, abre el repositorio y ejecuta `git status` y `git log -1 --oneline`. Conserva una copia de tus cambios locales antes de incorporar archivos.
2. Extrae el ZIP en una carpeta aparte. Compara las carpetas frontend/ y docs/ con tu proyecto. Copia sus archivos a las mismas rutas del repositorio; si alguno tiene trabajo más reciente de un compañero, integra las diferencias en vez de reemplazarlo automáticamente.
3. Dentro de frontend/, ejecuta `npm ci`, `npm run build` y `npm test`.
4. Ejecuta `npm run dev` y abre la dirección que muestra Vite, normalmente http://localhost:5173.
5. Accede con correo `docente@5e.demo` y contraseña pública `Demo5E!2026`.
6. Crea un curso con dos unidades, edítalo y recarga la página. Comprueba que se conservan los cambios.
7. Desde el menú verifica las pantallas anteriores. Cierra sesión y comprueba que volver a /revision lleva a /login.
8. Captura el navegador con la dirección localhost visible para tu diapositiva. Las capturas incluidas se generaron automáticamente y no muestran la barra de direcciones.
9. Copia el contenido de docs/HU-045-Notion.md en la tarjeta HU-045 de Notion y adjunta las imágenes de docs/evidencias/HU-045/. Completa tus horas reales.

Para repetir las capturas y las pruebas de navegador:

```bash
npx playwright install chromium
npm run test:e2e
```

La prueba usa localhost:5174 y regenera docs/evidencias/HU-045/. Los datos de los casos de prueba son ficticios.

Cuando hayas comprobado los cambios, revisa `git diff` antes de hacer el commit. La publicación en GitHub la realiza Silvana desde su computadora; después agrega ese enlace a Notion.
