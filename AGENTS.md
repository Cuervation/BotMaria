# BotMaria - agentes determinísticos

Este proyecto es "agentic-style", pero **no usa LLM en runtime**. Codex puede modificar el código, pero el bot corriendo local solo usa reglas determinísticas.

## Reglas obligatorias

- No comprar entradas automáticamente.
- No clickear `Seleccionar`.
- No saltear fila virtual.
- No evadir captcha.
- No automatizar login escribiendo credenciales.
- Solo se permite clickear `Iniciar sesión` y luego `Ingresar` si las credenciales ya están cargadas/guardadas.
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

### DateDetectorAgent

Busca cards/filas con `Seleccionar`, parsea día/mes/hora y valida si el día matchea `TARGET_DAY_REGEX`.

Ignora cards que tengan `Agotado`.

### SpeakerAgent

Intenta cambiar la salida de audio a parlantes en Windows usando PowerShell y AudioDeviceCmdlets. Si falla, no corta el bot.

### AlarmAgent

Abre YouTube, intenta desmutear, poner volumen al 100% y reproducir el video. Usa cooldown para evitar múltiples disparos.
