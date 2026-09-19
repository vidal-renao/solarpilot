"use client";

/**
 * Descarga la propuesta usando el dialogo de impresion del navegador.
 *
 * Decision deliberada frente a generar el PDF en servidor: la hoja de estilos
 * de impresion ya produce un documento correcto, cualquier navegador sabe
 * guardarlo como PDF, y evita arrastrar una libreria de maquetacion y un
 * segundo juego de plantillas que mantener sincronizado con el de pantalla.
 *
 * Cuando haga falta enviar el PDF por correo sin que intervenga nadie —que es
 * el caso que esto no cubre— habra que renderizarlo en servidor.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-line px-4 py-2 text-sm transition-colors hover:border-sun hover:text-sun"
    >
      Descargar o imprimir
    </button>
  );
}
