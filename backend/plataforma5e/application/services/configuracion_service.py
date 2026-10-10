"""EP-002 y HU-001: cuentas de docente, sesiones, cursos y archivos. La extracción vive en material_service."""
import hashlib
import hmac
import re
import secrets
import time
from datetime import datetime, timezone
from uuid import uuid4
from plataforma5e.application.ports.configuracion_repository import ConfiguracionRepositoryPort
from plataforma5e.domain.configuracion import ConfiguracionError

MAX_ARCHIVO = 25 * 1024 * 1024
TIPOS = {'Separata o apuntes de clase', 'Diapositivas de clase', 'Guía de práctica', 'Sílabo de la unidad', 'Transcripción de clase'}
DURACION_SESION = 8 * 3600
ITERACIONES = 200000
CORREO_VALIDO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _huella_clave(clave: str, sal: bytes) -> bytes:
    return hashlib.pbkdf2_hmac('sha256', clave.encode(), sal, ITERACIONES)


class ConfiguracionService:
    def __init__(self, repo: ConfiguracionRepositoryPort, correo: str, clave: str, catalogo_demo: bool = True,
                 nombre: str = 'Docente'):
        """`correo` y `clave` forman la cuenta inicial (configurada en el servidor); si están vacíos no hay
        cuenta inicial. Las demás cuentas se crean con `registrar_cuenta` y se guardan con su contraseña cifrada
        (PBKDF2). `catalogo_demo` siembra el curso de ejemplo al iniciar sesión: solo lo usan las pruebas."""
        self.repo = repo
        self.correo = correo.strip().lower()
        self.nombre = nombre
        self.catalogo_demo = catalogo_demo
        self._sal = secrets.token_bytes(16)
        self._clave = _huella_clave(clave, self._sal)

    def registrar_cuenta(self, nombre, correo, clave):
        correo = correo.strip().lower()
        nombre = ' '.join(str(nombre).split())
        if len(nombre) < 2:
            raise ConfiguracionError('NOMBRE_INVALIDO', 'Escribe tu nombre.', 422)
        if not CORREO_VALIDO.match(correo):
            raise ConfiguracionError('CORREO_INVALIDO', 'Escribe un correo válido.', 422)
        if len(clave) < 8:
            raise ConfiguracionError('CLAVE_INSEGURA', 'La contraseña debe tener al menos 8 caracteres.', 422)
        if correo == self.correo or self.repo.usuario_obtener(correo):
            raise ConfiguracionError('CUENTA_EXISTENTE', 'Ya existe una cuenta con ese correo. Inicia sesión.', 409)
        sal = secrets.token_bytes(16)
        self.repo.usuario_crear({'email': correo, 'nombre': nombre, 'sal': sal.hex(), 'clave': _huella_clave(clave, sal).hex(),
                                 'creado': datetime.now(timezone.utc).isoformat()})
        return self._abrir_sesion(correo, nombre)

    def login(self, correo, clave):
        correo = correo.strip().lower()
        usuario = self.repo.usuario_obtener(correo)
        if usuario:
            valida = hmac.compare_digest(_huella_clave(clave, bytes.fromhex(usuario['sal'])).hex(), usuario['clave'])
            nombre = usuario['nombre']
        else:
            # Se calcula la huella aunque el correo no exista: la respuesta tarda lo mismo en ambos casos.
            valida = (hmac.compare_digest(_huella_clave(clave, self._sal), self._clave)
                      and bool(self.correo) and correo == self.correo)
            nombre = self.nombre
        if not valida:
            raise ConfiguracionError('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.', 401)
        if self.catalogo_demo and correo == self.correo:
            self.repo.iniciar_catalogo(correo)  # solo la cuenta inicial de las pruebas recibe el curso de ejemplo
        return self._abrir_sesion(correo, nombre)

    def _abrir_sesion(self, correo, nombre):
        token = secrets.token_urlsafe(32)
        self.repo.sesion_guardar(hashlib.sha256(token.encode()).hexdigest(), correo, time.time() + DURACION_SESION)
        return {'email': correo, 'name': nombre, 'token': token, 'expiresIn': DURACION_SESION}

    def perfil(self, correo):
        usuario = self.repo.usuario_obtener(correo)
        return {'email': correo, 'name': usuario['nombre'] if usuario else self.nombre}

    def autenticar(self, authorization):
        if not authorization or not authorization.startswith('Bearer '):
            raise ConfiguracionError('SESION_REQUERIDA', 'Inicia sesión con el backend.', 401)
        huella = hashlib.sha256(authorization[7:].encode()).hexdigest()
        sesion = self.repo.sesion_obtener(huella)
        if not sesion or sesion[1] <= time.time():
            raise ConfiguracionError('SESION_VENCIDA', 'La sesión venció. Vuelve a iniciar sesión.', 401)
        return sesion[0]

    def logout(self, authorization):
        self.autenticar(authorization)
        self.repo.sesion_borrar(hashlib.sha256(authorization[7:].encode()).hexdigest())

    def unidad(self, docente, id):
        unidad = next((u for c in self.repo.cursos(docente) for u in c['units'] if u['id'] == id), None)
        if not unidad: raise ConfiguracionError('UNIDAD_NO_ENCONTRADA', 'La unidad no pertenece a tus cursos.', 404)
        return unidad

    def guardar_curso(self, docente, datos, id=None):
        cursos = self.repo.cursos(docente)
        anterior = next((c for c in cursos if c['id'] == id), None)
        if id and not anterior: raise ConfiguracionError('CURSO_NO_ENCONTRADO', 'El curso no existe.', 404)
        codigo = datos['code'].strip().upper()
        if any(c['id'] != id and c['code'] == codigo for c in cursos):
            raise ConfiguracionError('CODIGO_DUPLICADO', 'Ya existe un curso con ese código.', 409)
        previas = anterior['units'] if anterior else []
        ids = [u.get('id') for u in datos['units'] if u.get('id')]
        if len(set(ids)) != len(ids) or set(ids) != {u['id'] for u in previas}:
            raise ConfiguracionError('UNIDADES_INVALIDAS', 'Conserva las unidades existentes y sus identificadores.')
        curso = {'id': id or f'curso-{uuid4()}', **{k: datos[k].strip() for k in ('code', 'name', 'term')}}
        curso['code'] = codigo
        # Sumilla y logro: los usa la generación como contexto. Si no llegan, se conservan los anteriores.
        for campo in ('sumilla', 'logro'):
            valor = datos.get(campo)
            curso[campo] = valor.strip() if isinstance(valor, str) else (anterior or {}).get(campo, '')
        unidades = []
        numero = max([u['number'] for u in previas], default=0)
        for u in datos['units']:
            anterior_u = next((p for p in previas if p['id'] == u.get('id')), None)
            if not anterior_u: numero += 1
            numero_u = anterior_u['number'] if anterior_u else numero
            unidades.append({'id': anterior_u['id'] if anterior_u else f'unidad-{uuid4()}', 'courseId': curso['id'], 'number': numero_u, 'title': u['title'].strip(), 'outcomes': self._resultados(u.get('outcomes'), anterior_u, numero_u)})
        curso['units'] = unidades
        self.repo.curso_guardar(docente, curso)
        return curso

    @staticmethod
    def _resultados(entrada, anterior_u, numero):
        """Resultados de aprendizaje de la unidad. Sin entrada se conservan los anteriores;
        con entrada se respetan los ids existentes y se crean códigos RA<unidad>.<n> para los nuevos."""
        previos = anterior_u['outcomes'] if anterior_u else []
        if entrada is None:
            return previos
        ids_previos = {o['id'] for o in previos}
        resultado, usados = [], set()
        for indice, o in enumerate(entrada, start=1):
            texto = ' '.join(str(o.get('text', '')).split())
            if not texto:
                continue
            ident = o.get('id') if o.get('id') in ids_previos and o.get('id') not in usados else f'ra-{uuid4().hex[:8]}'
            usados.add(ident)
            codigo = ' '.join(str(o.get('code') or '').split()) or f'RA{numero}.{indice}'
            resultado.append({'id': ident, 'code': codigo, 'text': texto})
        return resultado

    def registrar(self, docente, nombre, contenido, contexto):
        unidad = self.unidad(docente, contexto['unitId'])
        if not contexto['usePermission']: raise ConfiguracionError('PERMISO_REQUERIDO', 'Confirma el permiso de uso del material.')
        if contexto['documentType'] not in TIPOS: raise ConfiguracionError('TIPO_INVALIDO', 'Elige un tipo de documento válido.')
        ra = contexto['outcomeIds']
        if not set(ra).issubset({o['id'] for o in unidad['outcomes']}) or (unidad['outcomes'] and not ra):
            raise ConfiguracionError('RESULTADO_INVALIDO', 'Selecciona resultados de aprendizaje de esta unidad.')
        if not nombre or len(nombre) > 200 or '/' in nombre or '\\' in nombre or any(ord(c) < 32 for c in nombre):
            raise ConfiguracionError('NOMBRE_INVALIDO', 'Usa un nombre de archivo válido.')
        kind = nombre.rsplit('.', 1)[-1].lower()
        if kind not in ('pdf', 'pptx', 'txt'): raise ConfiguracionError('FORMATO_INVALIDO', 'Usa PDF, PPTX o TXT.')
        if not contenido or len(contenido) > MAX_ARCHIVO: raise ConfiguracionError('TAMANO_INVALIDO', 'El archivo debe tener contenido y no superar 25 MB.')
        if kind == 'pdf' and not contenido.startswith(b'%PDF-'): raise ConfiguracionError('FORMATO_INVALIDO', 'El archivo no tiene cabecera PDF.')
        if kind == 'pptx':
            import io, zipfile
            try:
                with zipfile.ZipFile(io.BytesIO(contenido)) as z:
                    if '[Content_Types].xml' not in z.namelist() or 'ppt/presentation.xml' not in z.namelist(): raise ValueError()
            except (zipfile.BadZipFile, ValueError): raise ConfiguracionError('FORMATO_INVALIDO', 'El archivo no tiene estructura PPTX.')
        if kind == 'txt':
            try: contenido.decode('utf-8-sig')
            except UnicodeDecodeError: raise ConfiguracionError('FORMATO_INVALIDO', 'Guarda el TXT con codificación UTF-8.')
        if any(d['unitId'] == unidad['id'] and d['fileName'].casefold() == nombre.casefold() for d in self.repo.documentos(docente)):
            raise ConfiguracionError('DOCUMENTO_DUPLICADO', 'Ya existe un documento con ese nombre en la unidad.', 409)
        datos = {**contexto, 'id': f'doc-api-{uuid4()}', 'fileName': nombre, 'kind': kind, 'sizeBytes': len(contenido), 'status': 'registrado', 'currentStep': None, 'registeredAt': datetime.now(timezone.utc).isoformat(), 'processedAt': None, 'fragmentCount': 0, 'pageCount': None, 'errorMessage': None, 'isDemo': False, 'source': 'backend'}
        self.repo.documento_guardar(docente, datos, contenido)
        return datos

    def comprobar_generacion(self, id, authorization):
        propietario = self.repo.propietario_generacion(id)
        if propietario and self.autenticar(authorization) != propietario:
            raise ConfiguracionError('GENERACION_NO_ENCONTRADA', 'La solicitud no existe.', 404)


    def listar_cursos(self, docente):
        return self.repo.cursos(docente)

    def borrar_curso(self, docente, id):
        """Borra el curso con todo lo de sus unidades: documentos, fragmentos, recursos y descargas."""
        curso = next((c for c in self.repo.cursos(docente) if c['id'] == id), None)
        if curso is None:
            raise ConfiguracionError('CURSO_NO_ENCONTRADO', 'El curso no existe.', 404)
        self.repo.curso_borrar(docente, id, [u['id'] for u in curso['units']])

    def listar_documentos(self, docente):
        return self.repo.documentos(docente)

    def obtener_documento(self, docente, id):
        documento = self.repo.documento_obtener(docente, id)
        if documento is None:
            raise ConfiguracionError('DOCUMENTO_NO_ENCONTRADO', 'El documento no existe.', 404)
        return documento

    def borrar_documento(self, docente, id):
        self.obtener_documento(docente, id)
        self.repo.documento_borrar(docente, id)

    def listar_solicitudes(self, docente):
        return sorted(self.repo.historial(docente), key=lambda r: r['createdAt'], reverse=True)
