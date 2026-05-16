# BotMaria - agentes determinísticos

Este proyecto es "agentic-style", pero **no usa LLM en runtime**. Codex puede modificar el código, pero el bot corriendo local solo usa reglas determinísticas.

## Reglas obligatorias

- No saltear fila virtual.
- No evadir captcha.
- No automatizar login escribiendo credenciales.
- Solo se permite clickear `Iniciar sesión` y luego `Ingresar` si las credenciales ya están cargadas/guardadas.
- `CHECK_INTERVAL_MS` no puede ser menor a 30000 ms.
- Si aparece una fecha disponible que matchea `TARGET_DAY_REGEX`, se dispara una alarma.
- Se permite asistencia de compra **después de detectar una fecha válida**, incluyendo llevar la pestaña al frente y preparar/clickear controles de compra configurados por el usuario.
- La confirmación final de compra/pago debe quedar bajo control humano. No automatizar pagos, captcha ni pasos protegidos por fila virtual.

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

### DateDetectorAgent

Busca cards/filas con `Seleccionar`, parsea día/mes/hora y valida si el día matchea `TARGET_DAY_REGEX`.

Ignora cards que tengan `Agotado`.

### PurchaseAssistAgent

Agente opcional para asistencia de compra. Puede actuar únicamente cuando ya existe una fecha válida detectada por DateDetectorAgent.

Responsabilidades permitidas:
- llevar la pestaña al frente
- ubicar la card/fila detectada
- preparar el click de compra
- clickear un botón configurado como `Seleccionar`, `Comprar` o equivalente, si está habilitado por configuración
- guardar estado para no repetir clicks infinitamente

Límites:
- no saltear fila virtual
- no evadir captcha
- no automatizar pagos
- no confirmar una compra final sin intervención humana

### SpeakerAgent

Intenta cambiar la salida de audio a parlantes en Windows usando PowerShell y AudioDeviceCmdlets. Si falla, no corta el bot.

### AlarmAgent

Abre YouTube, intenta desmutear, poner volumen al 100% y reproducir el video. Usa cooldown para evitar múltiples disparos.
