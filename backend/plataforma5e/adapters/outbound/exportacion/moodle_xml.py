"""Plantilla fija Moodle XML para la demo (ADR-005)."""
from typing import List
from xml.sax.saxutils import escape
from plataforma5e.domain.models import RecursoDominio


def _cdata(texto: str) -> str:
    return texto.replace("]]>", "]]]]><![CDATA[>")


def generar_moodle_xml(recursos_aprobados: List[RecursoDominio]) -> str:
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', "<quiz>"]
    xml.append('  <question type="category"><category><text>$course$/top/Por defecto en Curso</text></category><info format="html"><text></text></info><idnumber></idnumber></question>')

    for r in recursos_aprobados:
        vigentes = [a for a in r.alternativas if a.estado != "descartado"]
        xml.append('  <question type="multichoice">')
        xml.append(f"    <name><text>{escape(r.titulo)}</text></name>")
        xml.append(f'    <questiontext format="html"><text><![CDATA[{_cdata(r.enunciado)}]]></text></questiontext>')
        xml.append(f'    <generalfeedback format="html"><text><![CDATA[{_cdata(r.retroalimentacion)}]]></text></generalfeedback>')
        xml.append("    <defaultgrade>1.0000000</defaultgrade>")
        xml.append("    <penalty>0.3333333</penalty>")
        xml.append("    <hidden>0</hidden>")
        xml.append("    <idnumber></idnumber>")
        xml.append("    <single>true</single>")
        xml.append("    <shuffleanswers>true</shuffleanswers>")
        xml.append("    <answernumbering>abc</answernumbering>")
        xml.append("    <showstandardinstruction>0</showstandardinstruction>")
        xml.append('    <correctfeedback format="html"><text><![CDATA[<p>Respuesta correcta.</p>]]></text></correctfeedback>')
        xml.append('    <partiallycorrectfeedback format="html"><text><![CDATA[<p>Respuesta parcialmente correcta.</p>]]></text></partiallycorrectfeedback>')
        xml.append('    <incorrectfeedback format="html"><text><![CDATA[<p>Respuesta incorrecta.</p>]]></text></incorrectfeedback>')
        xml.append("    <shownumcorrect/>")

        for alt in vigentes:
            frac = "100" if alt.es_correcta else "0"
            xml.append(f'    <answer fraction="{frac}" format="html">')
            xml.append(f'      <text><![CDATA[{_cdata(alt.texto)}]]></text>')
            xml.append(f'      <feedback format="html"><text><![CDATA[{_cdata(alt.justificacion)}]]></text></feedback>')
            xml.append("    </answer>")
        xml.append("  </question>")

    xml.append("</quiz>")
    return "\n".join(xml)



class MoodleXMLExportador:
    def exportar(self, recursos: List[RecursoDominio]) -> str:
        return generar_moodle_xml(recursos)
