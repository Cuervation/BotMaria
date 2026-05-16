# BotMaria

Bot local de monitoreo y asistencia de compra para fechas de María Becerra en Movistar Arena.

Cuando aparece una fecha disponible cuyo día empieza con `2` —por ejemplo 20, 21, 22, etc.— abre este video de YouTube como alarma:

https://www.youtube.com/watch?v=Terd4qKkb6k

## Qué hace

- Abre Chromium visible con Playwright.
- Puede autenticar con un login liviano:
  - click en `Iniciar sesión`
  - click en `Ingresar`
- No escribe usuario ni contraseña.
- Monitorea fila virtual / waiting room y puede continuar cuando el sitio habilite controles normales.
- Intenta cambiar audio a parlantes y volumen 100% antes de disparar YouTube.
- Permite evolucionar a asistencia de compra configurable cuando detecta una fecha válida.

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

## Compra asistida

El proyecto permite que Codex implemente un `PurchaseAssistAgent` para actuar cuando aparece una fecha válida.

Flujo esperado:

1. Detectar fecha 20-29 disponible.
2. Ignorar fechas con `Agotado`.
3. Disparar alarma.
4. Llevar la pestaña al frente.
5. Clickear el botón configurado, por ejemplo `Comprar` o `Seleccionar`, si la opción está habilitada por `.env`.
6. Guardar estado para no repetir clicks infinitamente.
7. Detenerse ante captcha, pago final o confirmación irreversible.

Variables:

```env
PURCHASE_ASSIST_ENABLED=true
PURCHASE_CLICK_ENABLED=true
PURCHASE_BUTTON_TEXT=Comprar
PURCHASE_FALLBACK_BUTTON_TEXT=Seleccionar
PURCHASE_ACTION_COOLDOWN_MINUTES=60
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

LOGIN_ENABLED=true
LOGIN_START_TEXT=Iniciar sesión
LOGIN_SUBMIT_TEXT=Ingresar

PURCHASE_ASSIST_ENABLED=true
PURCHASE_CLICK_ENABLED=true
PURCHASE_BUTTON_TEXT=Comprar
PURCHASE_FALLBACK_BUTTON_TEXT=Seleccionar
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
5. Si aparece una fecha `20-29` con `Seleccionar` / `Comprar`, abre YouTube y dispara alarma.
6. Si Codex implementa `PurchaseAssistAgent`, puede clickear el botón configurado y avanzar hasta donde el flujo normal del sitio lo permita.
7. Ante captcha, pago final o confirmación irreversible, debe quedar intervención humana.

## Resetear alarma

El bot evita disparar muchas veces usando:

```txt
state/alarm-fired.json
```

Para resetear:

```bash
del state\alarm-fired.json
```

## Resetear acción de compra asistida

Cuando Codex implemente `PurchaseAssistAgent`, debería usar:

```txt
state/purchase-action-fired.json
```

Para resetear:

```bash
del state\purchase-action-fired.json
```

## Probar parser sin esperar a la web real

```bash
npm test
```
