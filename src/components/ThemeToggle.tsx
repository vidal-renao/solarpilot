"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Clave en el almacenamiento local. La comparte el script antiparpadeo. */
export const THEME_KEY = "solarpilot-theme";

/**
 * Script que corre antes de pintar.
 *
 * Sin esto, la pagina se dibuja con el tema por defecto y salta al elegido en
 * cuanto React hidrata: un fogonazo blanco para quien usa el tema oscuro. Va
 * en el `<head>` y es sincrono a proposito.
 *
 * Se envuelve en try/catch porque en navegacion privada leer el
 * almacenamiento puede lanzar, y un tema equivocado es mejor que una pagina
 * en blanco.
 */
export const THEME_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeToggle() {
  // Hasta que el componente monta no se sabe el tema real, asi que el boton
  // no anuncia nada: evita decir "cambiar a claro" cuando ya esta en claro.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const declarado = document.documentElement.getAttribute("data-theme");
    setTheme(declarado === "light" || declarado === "dark" ? declarado : systemTheme());
  }, []);

  const cambiar = () => {
    const siguiente: Theme = theme === "light" ? "dark" : "light";
    setTheme(siguiente);
    document.documentElement.setAttribute("data-theme", siguiente);
    try {
      localStorage.setItem(THEME_KEY, siguiente);
    } catch {
      // Sin almacenamiento el cambio vale para esta visita y no se recuerda.
    }
  };

  const esClaro = theme === "light";

  return (
    <button
      type="button"
      onClick={cambiar}
      // Mientras no se conoce el tema el boton sigue siendo pulsable, pero no
      // afirma a que estado lleva.
      aria-label={theme ? `Cambiar al tema ${esClaro ? "oscuro" : "claro"}` : "Cambiar el tema"}
      title={theme ? `Cambiar al tema ${esClaro ? "oscuro" : "claro"}` : "Cambiar el tema"}
      className="rounded-full border border-line p-1.5 text-mist-dim transition-colors hover:border-sun hover:text-sun"
    >
      {/* Sol y luna en un mismo trazo, para que el boton no salte de tamano. */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {esClaro ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
    </button>
  );
}
