"""Pruebas unitarias de la capa de aplicación con puertos falsos en memoria.

No usan base de datos ni HTTP: cada servicio recibe un repositorio falso que cumple su
puerto. Así se comprueba la regla de negocio aislada de los adaptadores (arquitectura
hexagonal, EN-004).
"""
import io
import time
import zipfile
from copy import deepcopy

import pytest

from plataforma5e.application.ports.recurso_repository import RecursoRepositoryPort
from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.application.services.generacion_service import GeneracionService
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.domain.configuracion import ConfiguracionError
from plataforma5e.domain.generacion import GeneracionError
from plataforma5e.domain.models import AlternativaDominio, RecursoDominio


# --------------------------------------------------------------------------- recursos

class RecursoRepoFalso(RecursoRepositoryPort):
    def __init__(self, recursos):
        self.recursos = {r.id: r for r in recursos}
        self.guardados = 0

    def obtener_todos(self):
        return list(self.recursos.values())

    def obtener_por_id(self, recurso_id):
        return self.recursos.get(recurso_id)

    def guardar(self, recurso):
        self.guardados += 1
        self.recursos[recurso.id] = recurso
        return recurso

    def reiniciar_demo(self):
        return list(self.recursos.values())


def _item(id="rec-1"):
    return RecursoDominio(
        id=id,
        titulo="Tope de la pila",
        enunciado="¿Qué elemento queda en el tope?",
        retroalimentacion="La pila es LIFO.",
        alternativas=[
            AlternativaDominio("A", "7", True, "Último en entrar"),
            AlternativaDominio("B", "3", False, "Primero en entrar"),
            AlternativaDominio("C", "5", False, "Elemento intermedio"),
        ],
    )


def test_decisiones_sobre_alternativas():
    repo = RecursoRepoFalso([_item()])
    servicio = RecursoService(repo)
    servicio.tomar_decision_alternativa("rec-1", "A", "aceptar")
    servicio.tomar_decision_alternativa("rec-1", "B", "descartar")
    recurso = servicio.tomar_decision_alternativa("rec-1", "C", "editar", "6")
    estados = {a.letra: (a.estado, a.texto) for a in recurso.alternativas}
    assert estados == {"A": ("aceptado", "7"), "B": ("descartado", "3"), "C": ("editado", "6")}
    assert repo.guardados == 3


def test_editar_sin_texto_conserva_el_texto():
    servicio = RecursoService(RecursoRepoFalso([_item()]))
    recurso = servicio.tomar_decision_alternativa("rec-1", "C", "editar")
    assert recurso.alternativas[2].texto == "5"


def test_recurso_o_alternativa_inexistente():
    servicio = RecursoService(RecursoRepoFalso([_item()]))
    with pytest.raises(ValueError, match="Recurso no encontrado"):
        servicio.tomar_decision_alternativa("no-existe", "A", "aceptar")
    with pytest.raises(ValueError, match="Alternativa no encontrada"):
        servicio.tomar_decision_alternativa("rec-1", "Z", "aceptar")
    with pytest.raises(ValueError, match="Recurso no encontrado"):
        servicio.aprobar_recurso("no-existe")


def test_no_se_aprueba_con_alternativas_pendientes():
    servicio = RecursoService(RecursoRepoFalso([_item()]))
    servicio.tomar_decision_alternativa("rec-1", "A", "aceptar")
    with pytest.raises(ValueError, match="aprobacion_bloqueada"):
        servicio.aprobar_recurso("rec-1")
    assert servicio.obtener_aprobados() == []


def test_aprobar_y_listar_solo_aprobados():
    repo = RecursoRepoFalso([_item("rec-1"), _item("rec-2")])
    servicio = RecursoService(repo)
    for letra in "ABC":
        servicio.tomar_decision_alternativa("rec-1", letra, "aceptar")
    assert servicio.aprobar_recurso("rec-1").estado_revision == "aprobado"
    assert [r.id for r in servicio.obtener_aprobados()] == ["rec-1"]
    assert servicio.obtener_recurso("rec-2").estado_revision == "borrador"
    assert len(servicio.generar_o_reiniciar_recursos()) == 2


# --------------------------------------------------------------------------- generación

CATALOGO = {
    "notice": "Datos ficticios de demostración.",
    "units": [{"id": "u2", "outcomes": [{"id": "ra-1"}]}],
    "documents": [{"id": "doc-1", "fileName": "separata.pdf", "unitId": "u2"}],
    "fragments": [
        {"id": "f-1", "documentId": "doc-1", "unitId": "u2", "location": "p. 1", "text": "Una pila es LIFO."},
        {"id": "f-2", "documentId": "doc-1", "unitId": "u2", "location": "p. 2", "text": "Apilar y desapilar."},
    ],
    "examples": [
        {
            "exampleId": "ex-guia", "unitId": "u2", "outcomeId": "ra-1", "stage": "explore", "type": "guia_exploracion",
            "title": "Guía de pilas", "body": "Explora la pila.", "options": None,
            "citations": [{"claim": "Definición", "fragmentIds": ["f-1"]}],
        },
        {
            "exampleId": "ex-item", "unitId": "u2", "outcomeId": "ra-1", "stage": "evaluate", "type": "item_opcion_multiple",
            "title": "Tope", "body": "¿Qué queda en el tope?",
            "citations": [{"claim": "LIFO", "fragmentIds": ["f-1"]}],
            "options": [
                {"id": "o1", "text": "7", "isCorrect": True, "feedback": "Bien", "sourceFragmentIds": ["f-2"]},
                {"id": "o2", "text": "3", "isCorrect": False, "feedback": "No", "sourceFragmentIds": ["f-2"]},
                {"id": "o3", "text": "5", "isCorrect": False, "feedback": "No", "sourceFragmentIds": []},
                {"id": "o4", "text": "1", "isCorrect": False, "feedback": "No", "sourceFragmentIds": []},
            ],
        },
    ],
}


class GeneracionRepoFalso:
    def __init__(self, catalogo=None):
        self.catalogo = deepcopy(catalogo or CATALOGO)
        self.guardadas = {}
        self.docentes = {}

    def catalogo_demo(self):
        return self.catalogo

    def guardar(self, resultado, docente=None):
        self.guardadas[resultado["request"]["id"]] = resultado
        self.docentes[resultado["request"]["id"]] = docente

    def obtener(self, generacion_id):
        return self.guardadas.get(generacion_id)


def _solicitud(**cambios):
    base = {"unitId": "u2", "outcomeId": None, "stage": "explore", "resourceType": "guia_exploracion", "quantity": 1, "optionCount": 4}
    return {**base, **cambios}


def test_genera_con_evidencia_y_la_guarda():
    repo = GeneracionRepoFalso()
    servicio = GeneracionService(repo)
    resultado = servicio.generar(_solicitud(), "docente@5e.demo")
    recurso = resultado["resources"][0]
    assert resultado["mode"] == "api_demo" and resultado["available"] == 1
    assert recurso["status"] == "pendiente" and recurso["source"] == "api_demo"
    assert recurso["citations"][0]["fragmentIds"] == ["api-demo:f-1"]
    assert [f["id"] for f in resultado["fragments"]] == ["api-demo:f-1"]
    assert resultado["documents"][0]["id"] == "api-demo:doc-1"
    assert repo.docentes[resultado["request"]["id"]] == "docente@5e.demo"
    assert servicio.obtener(resultado["request"]["id"]) is resultado


def test_genera_un_item_con_alternativas_sin_decidir():
    servicio = GeneracionService(GeneracionRepoFalso())
    resultado = servicio.generar(_solicitud(stage="evaluate", resourceType="item_opcion_multiple", outcomeId="ra-1"))
    opciones = resultado["resources"][0]["options"]
    assert len(opciones) == 4 and all(o["decision"] == "pendiente" for o in opciones)
    assert sum(o["isCorrect"] for o in opciones) == 1


def test_rechaza_solicitudes_sin_sustento():
    servicio = GeneracionService(GeneracionRepoFalso())
    casos = [
        (_solicitud(unitId="u9"), "SIN_MATERIAL_PROCESADO"),
        (_solicitud(outcomeId="ra-otra"), "RESULTADO_INVALIDO"),
        (_solicitud(resourceType="glosario"), "EVIDENCIA_INSUFICIENTE"),
        (_solicitud(stage="evaluate", resourceType="item_opcion_multiple", optionCount=5), "EVIDENCIA_INSUFICIENTE"),
    ]
    for solicitud, codigo in casos:
        with pytest.raises(GeneracionError) as error:
            servicio.generar(solicitud)
        assert error.value.codigo == codigo


def test_no_genera_si_falta_un_fragmento_o_su_documento():
    sin_fragmento = deepcopy(CATALOGO)
    sin_fragmento["fragments"] = []
    with pytest.raises(GeneracionError, match="Faltan fragmentos"):
        GeneracionService(GeneracionRepoFalso(sin_fragmento)).generar(_solicitud())
    sin_documento = deepcopy(CATALOGO)
    sin_documento["documents"] = []
    with pytest.raises(GeneracionError, match="documento de origen"):
        GeneracionService(GeneracionRepoFalso(sin_documento)).generar(_solicitud())


def test_obtener_generacion_inexistente():
    with pytest.raises(GeneracionError) as error:
        GeneracionService(GeneracionRepoFalso()).obtener("sol-no-existe")
    assert error.value.codigo == "GENERACION_NO_ENCONTRADA"


# --------------------------------------------------------------------------- configuración (EP-002)

class ConfiguracionRepoFalso:
    def __init__(self):
        self.sesiones, self.catalogos, self.docs, self.propietarios = {}, {}, {}, {}

    def iniciar_catalogo(self, docente):
        self.catalogos.setdefault(docente, [{
            "id": "curso-1", "code": "ED-201", "name": "Estructuras de datos", "term": "2026-II",
            "units": [{"id": "unidad-1", "courseId": "curso-1", "number": 1, "title": "Pilas", "outcomes": [{"id": "ra-1"}]}],
        }])

    def sesion_guardar(self, huella, docente, vence):
        self.sesiones[huella] = (docente, vence)

    def sesion_obtener(self, huella):
        return self.sesiones.get(huella)

    def sesion_borrar(self, huella):
        self.sesiones.pop(huella, None)

    def cursos(self, docente):
        return deepcopy(self.catalogos.get(docente, []))

    def curso_guardar(self, docente, curso):
        cursos = [c for c in self.catalogos.get(docente, []) if c["id"] != curso["id"]]
        self.catalogos[docente] = cursos + [curso]

    def documentos(self, docente):
        return [d for (dueño, _), (d, _c) in self.docs.items() if dueño == docente]

    def documento_guardar(self, docente, datos, contenido):
        self.docs[(docente, datos["id"])] = (datos, contenido)

    def documento_obtener(self, docente, id):
        return self.docs.get((docente, id))

    def documento_borrar(self, docente, id):
        self.docs.pop((docente, id), None)

    def historial(self, docente):
        return []

    def propietario_generacion(self, id):
        return self.propietarios.get(id)


CORREO, CLAVE = "docente@5e.demo", "Demo5E!2026"


@pytest.fixture(scope="module")
def servicio_base():
    # PBKDF2 es lento a propósito: se crea una sola instancia para el módulo.
    return ConfiguracionService(ConfiguracionRepoFalso(), CORREO, CLAVE)


@pytest.fixture
def servicio(servicio_base):
    servicio_base.repo = ConfiguracionRepoFalso()
    return servicio_base


def _sesion(servicio):
    return "Bearer " + servicio.login(CORREO, CLAVE)["token"]


def _contexto(**cambios):
    base = {"unitId": "unidad-1", "usePermission": True, "documentType": "Guía de práctica", "outcomeIds": ["ra-1"]}
    return {**base, **cambios}


def _codigo(funcion, *args):
    with pytest.raises(ConfiguracionError) as error:
        funcion(*args)
    return error.value.codigo


def test_login_autentica_y_cierra_sesion(servicio):
    autorizacion = _sesion(servicio)
    assert servicio.autenticar(autorizacion) == CORREO
    servicio.logout(autorizacion)
    assert _codigo(servicio.autenticar, autorizacion) == "SESION_VENCIDA"


def test_credenciales_y_sesiones_invalidas(servicio):
    assert _codigo(servicio.login, CORREO, "otra") == "CREDENCIALES_INVALIDAS"
    assert _codigo(servicio.login, "otro@5e.demo", CLAVE) == "CREDENCIALES_INVALIDAS"
    assert _codigo(servicio.autenticar, None) == "SESION_REQUERIDA"
    assert _codigo(servicio.autenticar, "Token abc") == "SESION_REQUERIDA"
    autorizacion = _sesion(servicio)
    huella = next(iter(servicio.repo.sesiones))
    servicio.repo.sesiones[huella] = (CORREO, time.time() - 1)
    assert _codigo(servicio.autenticar, autorizacion) == "SESION_VENCIDA"


def test_unidad_solo_de_los_cursos_del_docente(servicio):
    servicio.login(CORREO, CLAVE)
    assert servicio.unidad(CORREO, "unidad-1")["title"] == "Pilas"
    assert _codigo(servicio.unidad, CORREO, "unidad-ajena") == "UNIDAD_NO_ENCONTRADA"


def test_crear_y_editar_curso(servicio):
    servicio.login(CORREO, CLAVE)
    nuevo = servicio.guardar_curso(CORREO, {"code": " ed-301 ", "name": "Grafos", "term": "2026-II", "units": [{"title": "Recorridos"}]})
    assert nuevo["code"] == "ED-301" and nuevo["units"][0]["number"] == 1
    unidad = nuevo["units"][0]
    editado = servicio.guardar_curso(CORREO, {"code": "ED-301", "name": "Grafos II", "term": "2026-II", "units": [{"id": unidad["id"], "title": "BFS y DFS"}, {"title": "Caminos"}]}, nuevo["id"])
    assert [u["number"] for u in editado["units"]] == [1, 2]
    assert editado["units"][0]["id"] == unidad["id"]


def test_reglas_del_catalogo(servicio):
    servicio.login(CORREO, CLAVE)
    datos = {"code": "ED-201", "name": "Copia", "term": "2026-II", "units": []}
    assert _codigo(servicio.guardar_curso, CORREO, datos) == "CODIGO_DUPLICADO"
    assert _codigo(servicio.guardar_curso, CORREO, {**datos, "code": "X-1"}, "curso-no-existe") == "CURSO_NO_ENCONTRADO"
    sin_unidades = {"code": "ED-201", "name": "Estructuras", "term": "2026-II", "units": []}
    assert _codigo(servicio.guardar_curso, CORREO, sin_unidades, "curso-1") == "UNIDADES_INVALIDAS"


def test_registra_material_valido(servicio):
    servicio.login(CORREO, CLAVE)
    doc = servicio.registrar(CORREO, "separata.pdf", b"%PDF-1.7 contenido", _contexto())
    assert doc["kind"] == "pdf" and doc["status"] == "registrado" and doc["source"] == "backend"
    pptx = io.BytesIO()
    with zipfile.ZipFile(pptx, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("ppt/presentation.xml", "<p/>")
    assert servicio.registrar(CORREO, "clase.pptx", pptx.getvalue(), _contexto())["kind"] == "pptx"
    assert servicio.registrar(CORREO, "notas.txt", "Pilas y colas".encode(), _contexto())["kind"] == "txt"
    assert _codigo(servicio.registrar, CORREO, "SEPARATA.pdf", b"%PDF-1.7", _contexto()) == "DOCUMENTO_DUPLICADO"


def test_rechaza_material_invalido(servicio):
    servicio.login(CORREO, CLAVE)
    casos = [
        ("a.pdf", b"%PDF-1", _contexto(usePermission=False), "PERMISO_REQUERIDO"),
        ("a.pdf", b"%PDF-1", _contexto(documentType="Otro"), "TIPO_INVALIDO"),
        ("a.pdf", b"%PDF-1", _contexto(outcomeIds=["ra-ajeno"]), "RESULTADO_INVALIDO"),
        ("a.pdf", b"%PDF-1", _contexto(outcomeIds=[]), "RESULTADO_INVALIDO"),
        ("../a.pdf", b"%PDF-1", _contexto(), "NOMBRE_INVALIDO"),
        ("a.docx", b"datos", _contexto(), "FORMATO_INVALIDO"),
        ("a.pdf", b"", _contexto(), "TAMANO_INVALIDO"),
        ("a.pdf", b"no es pdf", _contexto(), "FORMATO_INVALIDO"),
        ("a.pptx", b"no es zip", _contexto(), "FORMATO_INVALIDO"),
        ("a.txt", b"\xff\xfe\x00", _contexto(), "FORMATO_INVALIDO"),
    ]
    for nombre, contenido, contexto, codigo in casos:
        assert _codigo(servicio.registrar, CORREO, nombre, contenido, contexto) == codigo, nombre


def test_generacion_de_otro_docente_no_se_expone(servicio):
    autorizacion = _sesion(servicio)
    servicio.repo.propietarios["sol-1"] = "otro@5e.demo"
    assert _codigo(servicio.comprobar_generacion, "sol-1", autorizacion) == "GENERACION_NO_ENCONTRADA"
    servicio.repo.propietarios["sol-2"] = CORREO
    assert servicio.comprobar_generacion("sol-2", autorizacion) is None
    assert servicio.comprobar_generacion("sol-sin-dueño", None) is None
