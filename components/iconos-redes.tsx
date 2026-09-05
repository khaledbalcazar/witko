import type { SVGProps } from "react";
import type { Plataforma } from "@/lib/validation/tipos";

/**
 * Iconos de las redes.
 *
 * lucide-react dejo de incluir logos de marca en la version 1, asi que van
 * dibujados aca. Son glifos simples de una sola tinta, que heredan el color y
 * el tamano del texto como el resto de los iconos.
 */

type Props = SVGProps<SVGSVGElement>;

export function IconoInstagram(props: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function IconoFacebook(props: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function IconoTiktok(props: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3c0 2.8 2.2 5 5 5" />
    </svg>
  );
}

export const ICONO_PLATAFORMA: Record<
  Plataforma,
  (props: Props) => React.JSX.Element
> = {
  INSTAGRAM: IconoInstagram,
  FACEBOOK: IconoFacebook,
  TIKTOK: IconoTiktok,
};
