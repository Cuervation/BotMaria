# BotMaria - agentes determinísticos

Este proyecto es "agentic-style", pero **no usa LLM en runtime**. Codex puede modificar el código, pero el bot corriendo local usa reglas determinísticas.

## Reglas operativas

- Se permite asistencia de compra cuando aparece una fecha válida que matchea `TARGET_DAY_REGEX`.
- Se permite clickear controles configurados por el usuario, como `Comprar`, `Seleccionar`, `Continuar` o equivalentes, cuando estén disponibles por el flujo normal del sitio.
- Se permite monitorear fila virtual / waiting room, esperar, detectar cambios y continuar cuando el sitio habilite controles normales.
- Se permite login liviano: click en `Iniciar sesión` y luego `Ingresar` si las credenciales ya están cargadas/guardadas.
- No escribir usuario ni contraseña desde el bot.
- No evadir captcha ni resolverlo automáticamente.
- No romper protecciones técnicas del sitio.
- No automatizar pago final ni confirmación irreversible sin intervención humana.
- `CHECK_INTERVAL_MS` no puede ser menor a 30000 ms.
- Si aparece una fecha disponible que matchea `TARGET_DAY_REGEX`, se dispara una alarma.

## Agentes

### LoginAgent

Hace un login liviano:

1. Busca un botón/link/texto `Iniciar sesión`.
2. Hace click.
3. Espera.
4. Busca `Ingresar`.
5. Hace click.

No escribe usuario ni contraseña.

### MonitorAgent

Coordina el monitoreo de la página activa. Detecta:

- fila virtual / waiting room
- pantalla de selección de fechas
- errores temporales

Cuando DateDetectorAgent encuentra una fecha válida, puede invocar un agente de asistencia de compra si está habilitado por configuración.

### QueueMonitorAgent / lógica de fila

Puede monitorear la fila virtual o pantalla de espera y continuar cuando el sitio habilite controles normales.

Responsabilidades permitidas:

- detectar si la página está en waiting room / fila virtual
- esperar respetando `CHECK_INTERVAL_MS`
- refrescar estado de forma moderada si Codex lo implementa y el sitio lo permite
- continuar el flujo cuando aparezcan botones normales del sitio

Límites:

- no evadir captcha
- no romper protecciones técnicas
- no falsificar turnos
- no intentar vulnerar el sistema de fila

### DateDetectorAgent

Busca cards/filas con `Seleccionar`, parsea día/mes/hora y valida si el día matchea `TARGET_DAY_REGEX`.

Ignora cards que tengan `Agotado`.

### PurchaseAssistAgent

Agente opcional para asistencia de compra. Puede actuar cuando ya existe una fecha válida detectada por DateDetectorAgent.

Responsabilidades permitidas:

- llevar la pestaña al frente
- ubicar la card/fila detectada
- clickear un botón configurado como `Comprar`, `Seleccionar`, `Continuar` o equivalente
- usar fallback entre `PURCHASE_BUTTON_TEXT` y `PURCHASE_FALLBACK_BUTTON_TEXT`
- guardar estado para no repetir clicks infinitamente
- detenerse ante captcha, pantalla de pago o confirmación irreversible

Límites:

- no evadir captcha
- no automatizar pago final
- no confirmar una compra irreversible sin intervención humana
- no romper protecciones técnicas del sitio

### SpeakerAgent

Intenta cambiar la salida de audio a parlantes en Windows usando PowerShell y AudioDeviceCmdlets. Si falla, no corta el bot.

### AlarmAgent

Abre YouTube, intenta desmutear, poner volumen al 100% y reproducir el video. Usa cooldown para evitar múltiples disparos.
