from plataforma5e.domain.models import RecursoDominio, AlternativaDominio


def test_creacion_recurso_dominio():
    """Valida la instanciación de la entidad de dominio pura."""
    alternativa = AlternativaDominio(
        letra="A",
        texto="Fotosíntesis",
        es_correcta=True,
        justificacion="Es el proceso metabólico correcto",
    )

    recurso = RecursoDominio(
        id="rec-001",
        titulo="Pregunta de Biología",
        enunciado="¿Qué proceso realizan las plantas autótrofas?",
        retroalimentacion="Las plantas usan luz solar para sintetizar nutrientes.",
        alternativas=[alternativa],
    )

    assert recurso.id == "rec-001"
    assert recurso.titulo == "Pregunta de Biología"
    assert len(recurso.alternativas) == 1
    assert recurso.alternativas[0].es_correcta is True
    assert recurso.estado_revision == "borrador"