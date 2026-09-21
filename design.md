# design.md — Sistema de diseño de StudIA

Define cómo se ve StudIA. `CLAUDE.md` define cómo se construye. Es un borrador inicial: se ajusta tras revisar referencias en Figma.

## Dirección visual
Sobrio, serio y de confianza (se manejan documentos confidenciales). Referencias de tono: Linear, Notion, Stripe Dashboard. Sin degradados morados por defecto, sin tarjetas idénticas repetidas, sin glassmorphism ni animaciones decorativas.

## Principios
- La corrección por criterios es la estrella: nota por criterio, evidencia resaltada y feedback legibles de un vistazo.
- Densidad media, mucho aire, tipografía clara. Una acción principal por pantalla.
- Español natural y directo. Los pagos de demostración siempre con aviso visible.

## Tokens (a concretar)
- Color: neutros (fondo, superficie, borde, texto) + un color de marca y semánticos (éxito, aviso, error, información). Roles definidos como variables CSS en `globals.css`, con valores para claro y oscuro. Contraste mínimo AA.
- Tipografía: pila de sistema hoy; escala modular (12/14/16/20/24/32). Cuerpo 16 px, interlineado 1.5.
- Espaciado: múltiplos de 4 px. Radios: 6 y 10 px. Sombras mínimas.
- Breakpoints: móvil primero; 640, 768, 1024, 1280.

## Componentes y estados
Botón, campo, tabla, tarjeta, badge, diálogo, aviso. Cada uno con: normal, hover, foco visible, desactivado, carga, error y vacío. Base recomendada: shadcn/ui + Radix + Tailwind (skill `ui-ux-pro-max`).

## Prohibido
Texto gris sobre gris de bajo contraste, foco oculto, colores como único indicador de estado, layouts que rompan en móvil, iconos sin etiqueta accesible.
