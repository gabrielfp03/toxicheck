/**
 * Pie de página del sitio.
 *
 * Componente de servidor: no lleva `"use client"` porque no necesita nada del
 * navegador. El año se evalúa **en el build**, así que se actualiza solo en
 * cada despliegue sin JavaScript en el cliente.
 *
 * Además de la autoría, es el sitio donde toca la letra pequeña que antes
 * vivía sólo en la portada:
 *
 *  · La atribución a Open Food Facts. Los datos son ODbL y las **fotos** son
 *    Creative Commons BY-SA, que es una licencia distinta y también obliga a
 *    citar. Estando en el pie aparece en todas las pantallas, no sólo en la
 *    primera.
 *  · El descargo médico. Una app que puntúa alimentos tiene que dejar claro
 *    en todo momento que no sustituye a un profesional.
 */

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    /*
      El `pb-20` no es capricho: el botón flotante de escaneo está fijo en la
      esquina inferior derecha y, sin este colchón, al llegar al final del
      desplazamiento se plantaba justo encima de la línea de copyright.
    */
    <footer className="border-line mt-10 border-t pt-5 pb-20">
      <p className="muted text-xs leading-relaxed text-balance">
        Datos de productos de{" "}
        <a
          href="https://world.openfoodfacts.org"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          Open Food Facts
        </a>{" "}
        bajo licencia ODbL; las fotografías, bajo CC BY-SA. Todo el análisis se
        calcula en tu dispositivo: no enviamos nada a ningún servidor.
      </p>

      <p className="muted mt-2 text-xs leading-relaxed text-balance">
        Toxicheck es una herramienta de lectura de etiquetas y{" "}
        <strong className="font-semibold">no es consejo médico ni nutricional</strong>.
        Si tienes una alergia o una condición de salud, consulta siempre la
        etiqueta original y a un profesional.
      </p>

      <p className="muted mt-4 text-xs">
        © {year} <span className="font-semibold">Gabriel Filipov Petkov</span> ·
        Toxicheck
      </p>
    </footer>
  );
}
