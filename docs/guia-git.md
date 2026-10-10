# Guía de Git y GitHub

Esta guía es para que **tú** ejecutes las operaciones de Git y GitHub. Ningún asistente debe hacerlas por ti.
Usa una terminal (Git Bash, PowerShell o la terminal de VS Code) abierta en la carpeta raíz del proyecto:
`C:\Users\usuario\Desktop\taller-integrador`.

## 0. Preparación (una sola vez)

1. Instala Git desde <https://git-scm.com> si no lo tienes. Verifica:
   ```bash
   git --version
   ```
   Debe mostrar algo como `git version 2.x`.
2. Revisa tu identidad (es la que aparecerá como autora de los commits):
   ```bash
   git config --global user.name
   git config --global user.email
   ```
   Si no aparece nada, configúrala tú con tus propios datos:
   ```bash
   git config --global user.name "Tu Nombre"
   git config --global user.email "tu-correo@ejemplo.com"
   ```
   Usa el mismo correo que en tu cuenta de GitHub.

## 1. Esquema de ramas propuesto

| Rama | Para qué | Quién escribe en ella | Duración |
|---|---|---|---|
| `main` | Versiones estables, las que se presentan o entregan | Solo mediante pull request desde `develop` (o un `fix/` urgente) | Permanente |
| `develop` | Integración del trabajo del equipo | Solo mediante pull requests desde `feature/` y `fix/` | Permanente |
| `feature/nombre-descriptivo` | Una funcionalidad concreta, p. ej. `feature/filtros-revision` | Quien la desarrolla | Temporal: se borra al integrarla |
| `fix/nombre-descriptivo` | Una corrección, p. ej. `fix/contraste-etiquetas` | Quien corrige | Temporal: se borra al integrarla |

Reglas:

- **No** crear ramas permanentes por integrante (nada de `rama-juan`, `rama-silvana`). Las ramas se nombran por la tarea.
- Una rama `feature/` por historia o tarea pequeña; si dura más de una semana, probablemente es demasiado grande.
- Nombres en minúsculas, con guiones y sin tildes: `feature/carga-material-validacion`.

## 2. Primera subida del proyecto

### 2.1 Crear el repositorio vacío en GitHub

1. Entra a <https://github.com> → botón **New** (nuevo repositorio).
2. Nombre sugerido: `plataforma-5e-taller-integrador`. Visibilidad: **Private** si no quieres publicar los documentos del curso.
3. **No** marques «Add a README», «.gitignore» ni licencia (el proyecto ya los tiene).
4. Pulsa **Create repository** y copia la URL HTTPS (`https://github.com/TU-USUARIO/plataforma-5e-taller-integrador.git`).

### 2.2 Decidir si subes la carpeta `documentos/`

Contiene los documentos del equipo (Word y Excel). Si el repositorio es privado y el equipo está de acuerdo, puedes
incluirla. Si no, añade una línea `documentos/` al archivo `.gitignore` **antes** del paso 2.3.

### 2.3 Inicializar y hacer el primer commit

```bash
git init -b main
```
Crea el repositorio local con la rama `main`. Verifica: aparece `Initialized empty Git repository`.

```bash
git status
```
Lista los archivos nuevos. **Comprueba que NO aparezcan** `frontend/node_modules/` ni `frontend/dist/`
(el `.gitignore` los excluye). Deben aparecer `README.md`, `CLAUDE.md`, `.gitignore`, `docs/` y `frontend/`.

```bash
git add .
git status
```
Prepara todos los archivos. Ahora `git status` los muestra en verde bajo «Changes to be committed».

```bash
git commit -m "feat: frontend de demostración con seis pantallas navegables" -m "Incluye sistema de diseño, servicios simulados, datos de demostración, pruebas y documentación de continuidad."
```
Crea el primer commit. Verifica con:
```bash
git log --oneline
```
Debe mostrar una línea con tu mensaje.

### 2.4 Conectar con GitHub y subir `main`

```bash
git remote add origin https://github.com/TU-USUARIO/plataforma-5e-taller-integrador.git
git remote -v
```
`git remote -v` debe mostrar la URL dos veces (fetch y push).

```bash
git push -u origin main
```
Sube `main`. La primera vez, Git abrirá una ventana para iniciar sesión en GitHub. Verifica recargando la página del
repositorio: deben verse los archivos.

### 2.5 Crear `develop`

```bash
git switch -c develop
git push -u origin develop
```
Crea `develop` a partir de `main` y la sube. Verifica con `git branch -a`: debe listar `main`, `develop`,
`remotes/origin/main` y `remotes/origin/develop`.

### 2.6 Proteger las ramas (recomendado, en GitHub)

En el repositorio: **Settings → Branches → Add branch ruleset** (o *Branch protection rule*):

- Para `main` y `develop`: exigir pull request antes de integrar y al menos 1 aprobación.
- Opcional: en **Settings → General → Default branch**, poner `develop` como rama por defecto para que los PR apunten ahí.

Para invitar al equipo: **Settings → Collaborators → Add people**.

## 3. Trabajo diario con una rama `feature/`

```bash
git switch develop
git pull
```
Te sitúa en `develop` y trae lo último del equipo. Verifica: «Already up to date» o una lista de cambios.

```bash
git switch -c feature/nombre-descriptivo
```
Crea tu rama de trabajo. Verifica con `git branch`: la rama actual tiene un asterisco.

Trabaja y guarda cambios en commits pequeños:

```bash
git status
git add ruta/del/archivo-cambiado
git commit -m "feat: descripción corta en infinitivo"
```

Antes de subir, comprueba que todo funciona:

```bash
cd frontend
npm run build
npm test
cd ..
```

Sube la rama:

```bash
git push -u origin feature/nombre-descriptivo
```

### 3.1 Abrir el pull request (PR)

1. En GitHub aparecerá el aviso «Compare & pull request». Púlsalo.
2. **Base: `develop`** ← **compare: tu rama**.
3. Título claro y descripción: qué cambia, cómo probarlo, capturas si es visual, historia del backlog (p. ej. HU-010).
4. Pide revisión a un compañero. Si hay comentarios, corrige en la misma rama, haz commit y `git push` (el PR se actualiza solo).
5. Cuando esté aprobado: **Squash and merge** (o *Merge*), y luego **Delete branch**.

Después, en tu equipo:

```bash
git switch develop
git pull
git branch -d feature/nombre-descriptivo
```

## 4. Ramas `fix/`

- Corrección normal: igual que `feature/`, pero con nombre `fix/...` y a partir de `develop`.
- Corrección urgente de algo ya publicado en `main`: crea `fix/...` desde `main`, abre PR hacia `main` y, después,
  otro PR de `main` hacia `develop` para que la corrección no se pierda.

## 5. Publicar una versión estable

Cuando `develop` está probado (build, pruebas y recorrido manual):

1. En GitHub, abre un PR de **`develop` → `main`** con el título `Versión 0.x.0` y la lista de cambios.
2. Revisión y merge.
3. Opcional: crea una etiqueta desde **Releases → Draft a new release** con `v0.1.0`, o en la terminal:
   ```bash
   git switch main
   git pull
   git tag -a v0.1.0 -m "Primera versión del frontend de demostración"
   git push origin v0.1.0
   ```

## 6. Conflictos: qué son y cómo reducirlos

Las ramas **no eliminan los conflictos**: solo los posponen hasta el momento de integrar. Un conflicto ocurre cuando
dos personas cambian las mismas líneas de un archivo. Git no sabe cuál conservar y te pide decidir.

Resolver un conflicto (en tu rama):

```bash
git switch develop
git pull
git switch feature/mi-rama
git merge develop
```
Si hay conflicto, Git lo indica. Abre los archivos marcados (VS Code muestra botones «Accept Current / Incoming / Both»),
deja el contenido correcto, borra las marcas `<<<<<<<`, `=======`, `>>>>>>>`, y luego:
```bash
git add archivo-resuelto
git commit
npm run build   # dentro de frontend/, para comprobar que sigue funcionando
git push
```

### Reglas para archivos compartidos

Estos archivos los usa todo el equipo y concentran los conflictos:

| Archivo | Regla |
|---|---|
| `frontend/src/styles/tokens.css` | Solo cambia si el sistema de diseño se actualizó (responsable: Silvana Diaz). PR propio y pequeño |
| `frontend/src/components/ui.tsx`, `Icon.tsx`, `domain.tsx` | Avisar al equipo antes de cambiarlos. No cambiar la forma de uso de un componente sin actualizar todas las pantallas en el mismo PR |
| `frontend/src/types/index.ts` | Cambios acordados con quien lleva EN-003 (contratos). Añadir campos es más seguro que renombrar |
| `frontend/src/services/index.ts` | Solo añadir exportaciones; no reordenar |
| `package.json` / `package-lock.json` | Una sola persona añade dependencias por PR; si hay conflicto en el lock, rehacerlo con `npm install` |

Buenas prácticas:

- Integrar `develop` en tu rama al menos cada dos días (`git merge develop`).
- PR pequeños (idealmente menos de 300 líneas cambiadas).
- No reformatear archivos completos ni mover código sin necesidad en el mismo PR que un cambio funcional.
- Cada pantalla vive en su propio archivo de `pages/`: repartir el trabajo por pantallas reduce choques.

## 7. Convención de mensajes de commit

Formato: `tipo: descripción corta en minúsculas, en infinitivo o presente`.

| Tipo | Uso | Ejemplo |
|---|---|---|
| `feat` | Nueva funcionalidad | `feat: añadir filtro por resultado de aprendizaje en revisión` |
| `fix` | Corrección | `fix: evitar que se exporte un recurso devuelto a revisión` |
| `docs` | Documentación | `docs: actualizar estado del proyecto` |
| `style` | Estilos sin cambio de lógica | `style: ajustar espaciado de tarjetas de indicadores` |
| `refactor` | Reorganizar código sin cambiar el comportamiento | `refactor: separar formulario de carga en componentes` |
| `test` | Pruebas | `test: cubrir reglas de aprobación de ítems` |
| `chore` | Configuración y mantenimiento | `chore: actualizar dependencias de desarrollo` |

Los commits los firmas tú con tu identidad. No añadas líneas `Co-authored-by` ni menciones a herramientas de IA.

## 8. Comandos de consulta útiles (no modifican nada)

```bash
git status              # qué ha cambiado
git log --oneline -10   # últimos 10 commits
git diff                # cambios aún no preparados
git branch -a           # ramas locales y remotas
```

## Entrega HU-045

Los cambios se mantienen sin commit ni push. Silvana debe comparar e integrar los archivos sobre su copia local, ejecutar build y pruebas y revisar git diff antes de publicar. Consultar docs/HU-045-aplicar-cambios.md y enlazar el commit resultante en Notion.
