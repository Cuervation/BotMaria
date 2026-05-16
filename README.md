# BotMaria

Bot local de monitoreo para fechas de María Becerra en Movistar Arena.

Cuando aparece una fecha disponible cuyo día empieza con `2` —por ejemplo 20, 21, 22, etc.— abre este video de YouTube como alarma:

https://www.youtube.com/watch?v=Terd4qKkb6k

## Qué hace

- Abre Chromium visible con Playwright.
- Puede autenticar con un login liviano:
  - click en `Iniciar sesión`
  - click en `Ingresar`
- No escribe usuario ni contraseña.
- No saltea fila virtual.
- No evade captcha.
- Intenta cambiar audio a parlantes y volumen 100% antes de disparar YouTube.
- Puede evolucionar a asistencia de compra configurable cuando detecta una fecha válida.

## Compra asistida

El proyecto puede permitir que Codex implemente un `PurchaseAssistAgent` para actuar cuando aparece una fecha válida.

Flujo permitido:

1. Detectar fecha 20-29 disponible.
2. Ignorar fechas con `Agotado`.
3. Disparar alarma.
4. Llevar la pestaña al frente.
5. Clickear el botón configurado, por ejemplo `Seleccionar` o `Comprar`, si la opción está habilitada por `.env`.
6. Guardar estado para no repetir clicks infinitamente.

Límites que se mantienen:

- No saltear fila virtual.
- No evadir captcha.
- No automatizar pagos.
- No confirmar una compra final sin intervención humana.

Variables sugeridas para futuras iteraciones:

```env
PURCHASE_ASSIST_ENABLED=true
PURCHASE_CLICK_ENABLED=true
PURCHASE_BUTTON_TEXT=Comprar
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
4. El bot monitorea la pantalla de fechas.
5. Si aparece una fecha `20-29` con `Seleccionar`, abre YouTube y dispara alarma.
6. Si Codex implementa `PurchaseAssistAgent`, puede asistir el paso configurado de compra sin evadir fila/captcha ni confirmar pago automáticamente.

## Resetear alarma

El bot evita disparar muchas veces usando:

```txt
state/alarm-fired.json
```

Para resetear:

```bash
del state\alarm-fired.json
```

## Probar parser sin esperar a la web real

```bash
npm test
```
