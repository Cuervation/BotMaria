# BotMaria

Bot local de monitoreo y asistencia de compra para fechas de María Becerra en Movistar Arena.

Cuando aparece una fecha disponible cuyo día empieza con `2` —por ejemplo 20, 21, 22, etc.— abre este video de YouTube como alarma:

https://www.youtube.com/watch?v=vOapgSfSN1s&list=RDEMCgLb_8NFlBz0UcgoUIrqFQ&start_radio=1

## Qué hace

- Abre Chromium visible con Playwright.
- Puede autenticar con un login liviano:
  - click en `Iniciar sesión`
  - click en `Ingresar`
- No escribe usuario ni contraseña.
- Monitorea fila virtual / waiting room y puede continuar cuando el sitio habilite controles normales.
- Si todavía no está en la pantalla de fechas, puede clickear el botón general `Comprar`
  para entrar al flujo del evento.
- Intenta cambiar audio a parlantes y volumen 100% antes de disparar YouTube.
- Detecta fechas válidas con acción `Seleccionar` o `Comprar`.
- Avanza hasta dejarte parado en la pantalla de selección de la fecha detectada.
- No usa archivos persistentes para bloquear nuevos intentos válidos.

## Fila virtual / waiting room

El bot puede monitorear una fila virtual, esperar y continuar cuando el sitio habilite controles normales.

Variables sugeridas:

```env
QUEUE_MONITOR_ENABLED=true
QUEUE_CONTINUE_WHEN_AVAILABLE=true
```

Límites técnicos que se mantienen:

- No evadir captcha.
- No romper protecciones técnicas del sitio.
- No falsificar turnos.
- No vulnerar el sistema de fila.

## Entrada al flujo de fechas

Si el bot todavía no está en la pantalla de fechas, puede clickear el botón general
`Comprar` para entrar al flujo del evento.

Variables:

```env
ENTRY_TO_DATES_ENABLED=true
ENTRY_TO_DATES_BUTTON_TEXT=Comprar
ENTRY_TO_DATES_WAIT_MS=5000
```

## Texto de acción disponible

Las cards/filas de fechas se detectan buscando texto de acción como `Seleccionar`
o `Comprar`.

Variable:

```env
AVAILABLE_ACTION_TEXT_REGEX=Seleccionar|Comprar
```

## Compra asistida

El proyecto incluye un `PurchaseAssistAgent` para actuar cuando aparece una fecha válida.

Flujo esperado:

1. Detectar fecha 20-29 disponible.
2. Ignorar fechas con `Agotado`.
3. Disparar alarma.
4. Llevar la pestaña al frente.
5. Si está en pantalla previa, clickear `Comprar` sobre esa fecha.
6. Esperar la pantalla de fechas.
7. Clickear `Seleccionar` sobre la misma fecha.
8. Quedar detenido 30 minutos para intervención humana.
9. Detenerse ante captcha, pago final o confirmación irreversible.

Variables:

```env
PURCHASE_ASSIST_ENABLED=true
PURCHASE_CLICK_ENABLED=true
PURCHASE_BUTTON_TEXT=Comprar
PURCHASE_FALLBACK_BUTTON_TEXT=Seleccionar
PURCHASE_ACTION_COOLDOWN_MINUTES=0
```

## Instalación

```bash
npm install
npx playwright install
```

Copiá `.env.example` a `.env`:

```bash
copy .env.example .env
```

## Configuración básica

Editá `.env`:

```env
MONITOR_URL=
TARGET_ARTIST=María Becerra
TARGET_DAY_REGEX=^2\d$
CHECK_INTERVAL_MS=30000
ATTEMPT_RETRY_WAIT_MS=60000
HUMAN_INTERVENTION_WAIT_MS=1800000

LOGIN_ENABLED=true
LOGIN_START_TEXT=Iniciar sesión
LOGIN_SUBMIT_TEXT=Ingresar
ENTRY_TO_DATES_ENABLED=true
ENTRY_TO_DATES_BUTTON_TEXT=Comprar
ENTRY_TO_DATES_WAIT_MS=5000
AVAILABLE_ACTION_TEXT_REGEX=Seleccionar|Comprar

PURCHASE_ASSIST_ENABLED=true
PURCHASE_CLICK_ENABLED=true
PURCHASE_BUTTON_TEXT=Comprar
PURCHASE_FALLBACK_BUTTON_TEXT=Seleccionar
```

Para testing, podés usar:

```env
TARGET_DAY_REGEX=^(19|2\d)$
```

Podés dejar `MONITOR_URL` vacío. En ese caso el navegador abre y vos navegás manualmente hasta Movistar Arena. El bot monitorea la página activa.

## Login automático

El bot hace solamente esto:

1. Click en `Iniciar sesión`.
2. Click en `Ingresar`.

No tipea usuario ni clave. La idea es que user/pass ya estén cargados o guardados por el navegador.

Como usa `PLAYWRIGHT_USER_DATA_DIR=.playwright-profile`, la sesión puede quedar guardada entre ejecuciones.

## Parlantes con PowerShell

Primero instalá el módulo:

```powershell
Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser
```

Listá dispositivos:

```bash
npm run list-audio-devices
```

Configurá el nombre en `.env`:

```env
FORCE_SPEAKERS=true
SPEAKER_DEVICE_NAME=Altavoces
```

El nombre también puede ser algo como:

```txt
Speakers
Realtek Audio
Monitor
Altavoces
```

## Ejecutar

```bash
npm run dev
```

O:

```bash
npm run monitor
```

## Flujo recomendado

1. Ejecutá `npm run dev`.
2. Si `MONITOR_URL` está vacío, navegá manualmente hasta Movistar Arena.
3. El bot intenta iniciar sesión si ve `Iniciar sesión`.
4. El bot monitorea la pantalla de fechas o la fila virtual.
5. Si todavía no está en la pantalla de fechas, clickea el botón general `Comprar`.
6. Si aparece una fecha `19` o `20-29` con `Seleccionar` / `Comprar`, abre YouTube y dispara alarma.
7. Luego clickea `Comprar` o `Seleccionar` dentro de la misma card/fila detectada.
8. Si después aparece pantalla de fechas, clickea `Seleccionar` sobre esa misma fecha.
9. Queda detenido 30 minutos para intervención humana.
10. Ante captcha, pago final o confirmación irreversible, debe quedar intervención humana.

## Estado por intento

El bot ya no usa estos archivos como bloqueo persistente:

```txt
state/alarm-fired.json
state/purchase-action-fired.json
```

Si existen por versiones anteriores, se limpian automáticamente al empezar cada intento nuevo.

## Probar parser sin esperar a la web real

```bash
npm test
```
