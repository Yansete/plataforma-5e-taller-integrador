"""Dependencias de todas las capas mediante AST, incluidos imports relativos."""
import ast
from importlib.util import resolve_name
from pathlib import Path
import pytest

RAIZ = Path(__file__).resolve().parents[2] / 'plataforma5e'
REGLAS = {
    'domain': ('plataforma5e.application', 'plataforma5e.adapters', 'fastapi', 'sqlalchemy'),
    'application': ('plataforma5e.adapters', 'fastapi', 'sqlalchemy'),
    'adapters/inbound': ('sqlalchemy',),
}


def importaciones(fuente, paquete):
    for nodo in ast.walk(ast.parse(fuente)):
        if isinstance(nodo, ast.Import):
            yield from (alias.name for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom):
            modulo = nodo.module or ''
            if nodo.level:
                modulo = resolve_name('.' * nodo.level + modulo, paquete)
            yield modulo
            yield from (modulo + '.' + alias.name for alias in nodo.names)


def infracciones(fuente, paquete, prohibidos):
    return [nombre for nombre in importaciones(fuente, paquete)
            if any(nombre == p or nombre.startswith(p + '.') for p in prohibidos)]


@pytest.mark.parametrize('capa,prohibidos', REGLAS.items())
def test_capas_respetan_las_dependencias(capa, prohibidos):
    fallos = []
    archivos = list((RAIZ / capa).rglob('*.py'))
    assert archivos, f'No se encontraron módulos en {capa}'
    for archivo in archivos:
        paquete = '.'.join(('plataforma5e', *archivo.relative_to(RAIZ).parent.parts))
        errores = infracciones(archivo.read_text(encoding='utf-8'), paquete, prohibidos)
        fallos.extend(f'{archivo.relative_to(RAIZ)}: {nombre}' for nombre in errores)
    assert not fallos, '\n'.join(fallos)


@pytest.mark.parametrize('fuente,paquete,prohibido', [
    ('import fastapi as web', 'plataforma5e.domain', 'fastapi'),
    ('from sqlalchemy.exc import SQLAlchemyError', 'plataforma5e.adapters.inbound', 'sqlalchemy'),
    ('from plataforma5e import adapters', 'plataforma5e.application', 'plataforma5e.adapters'),
    ('from ..application import services', 'plataforma5e.domain', 'plataforma5e.application'),
    ('def funcion():\n    from ..adapters import inbound', 'plataforma5e.application', 'plataforma5e.adapters'),
])
def test_detecta_aliases_imports_relativos_y_dentro_de_funciones(fuente, paquete, prohibido):
    assert infracciones(fuente, paquete, (prohibido,))


def test_comentarios_y_textos_no_son_importaciones():
    assert infracciones('# import fastapi\ntexto = "sqlalchemy"', 'plataforma5e.domain', ('fastapi', 'sqlalchemy')) == []
