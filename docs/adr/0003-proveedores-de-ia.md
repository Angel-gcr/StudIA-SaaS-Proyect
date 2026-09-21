# ADR 0003 — Proveedores de IA: OpenCode Zen primero, Gemini opcional

- **Estado:** aceptado en lo esencial (prioridad de OpenCode y Gemini opcional, decididos por el propietario del producto el 2026-09-21). **Pendiente de confirmar:** que OpenCode Go no se use en producción (ver Decisión, punto 2).
- **Fecha:** 2026-09-21
- **Relacionado:** `CLAUDE.md` §2–3, `docs/TECNICO.md` §1.2 y §7

## Contexto
El propietario prioriza la suscripción de OpenCode (Go/Zen) frente a Gemini y quiere dejar Gemini conectable. Hechos verificados el 2026-09-21:

| | OpenCode Zen | OpenCode Go | Google Gemini API |
|---|---|---|---|
| Modelo de cobro | Pago por uso, precio por 1M tokens, saldo con recarga automática configurable y límites de gasto mensuales por workspace y miembro ([docs](https://opencode.ai/docs/zen/)) | Suscripción de 10 $/mes con límites de 5 h, semanal y mensual ([docs](https://opencode.ai/docs/go/)) | Nivel gratuito y de pago ([términos](https://ai.google.dev/gemini-api/terms)) |
| Uso permitido | La documentación no restringe el uso en aplicaciones propias. Las condiciones legales generales están **(sin verificar)**. | *"OpenCode Go is designed for OpenCode and other coding agents that produce similar types of requests."* El cliente debe *"Send typical coding agent traffic"* y *"Traffic is monitored for abuse"*. | Uso por API en aplicaciones propias |
| Retención y entrenamiento | La mayoría de modelos con retención cero. OpenAI y Anthropic retienen 30 días. Algunos modelos gratuitos y de prueba usan los datos para mejorar el modelo. | La mayoría "Not used" para entrenamiento y 0 días de retención; los modelos Grok retienen 30 días. | Gratuito: Google puede usar los datos y hacer revisión humana, salvo para usuarios del EEE, Suiza y Reino Unido, que reciben las protecciones del nivel de pago. De pago: no se usan para mejorar productos. |
| Alojamiento | Todos los modelos en EE. UU. | No lo especifica | **(sin verificar)** para la API |
| Endpoints | `https://opencode.ai/zen/v1/{chat/completions, responses, messages, models/<id>}` | `https://opencode.ai/zen/go/v1/...` | SDK de Google |

## Decisión
1. **Proveedor principal: OpenCode Zen** (`OpenCodeZenProvider`), limitado a una **lista blanca de modelos con retención cero** que no entrenen con los datos. La lista se fija en código y se revisa en cada plan de IA. Nunca modelos `Free` ni *Contributor*.
2. **OpenCode Go no se usa como backend del producto.** Sus condiciones lo limitan a tráfico de agentes de código. Las correcciones y el chat de StudIA no lo son, y usarlo arriesga la suspensión de la cuenta. Go puede seguir usándose para **desarrollar** con el agente OpenCode, sin datos reales de alumnos. *Si OpenCode confirma por escrito que Go admite este uso, se revisa este punto.*
3. **Gemini, adaptador opcional** (`GeminiProvider`): implementa la misma interfaz `AIProvider` y está **desactivado por defecto**. Se activa por variable de entorno de servidor (`GEMINI_API_KEY` presente) y por ajuste del ADMIN o del DUEÑO. En producción, solo el nivel de pago.
4. **Selección y respaldo**: `ProveedorIAConRespaldo` recibe una lista ordenada `[OpenCodeZen, Gemini?]`. Solo pasa a Gemini si está activado y si el tenant ha aceptado ese encargado de tratamiento. Nunca hay respaldo silencioso hacia un proveedor no aprobado.
5. **Control de gasto**: límite mensual en el workspace de Zen y desactivar la recarga automática en producción, además de las cuotas de créditos de StudIA (TECNICO §5.2).
6. **Embeddings**: `EmbeddingProvider` aparte. El proveedor se decide en el plan de la Fase 2: comprobar si Zen expone un endpoint de embeddings **(sin verificar)**. Si no, Gemini u otro con ADR.

## Consecuencias
- ✅ Se respeta la prioridad del propietario sin incumplir las condiciones de Go.
- ⚠️ **RGPD**: Zen aloja todo en EE. UU. → transferencia internacional. Hace falta DPA o condiciones de tratamiento de OpenCode y la base legal documentada antes de enviar datos de alumnos **(sin verificar: existencia del DPA)**.
- ⚠️ El coste es variable por token: se necesitan métricas de tokens por corrección antes de fijar precios.
- La regla de oro 4 sigue vigente: si se activa Gemini sin pago fuera del EEE, puede entrenar con los datos.
