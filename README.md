# movistar-arena-watchdog

Monitor de Movistar Arena con Playwright para detectar fechas disponibles de María Becerra y disparar una alarma abriendo un video de YouTube.

## Qué hace

- Abre la página configurada con **Playwright visible**.
- Usa un **perfil persistente** de Chrome/Chromium para conservar cookies y sesión.
- Revisa si aparece una fecha cuyo día matchee `TARGET_DAY_REGEX` para `TARGET_ARTIST`.
- Si detecta coincidencia, abre el video de alarma en YouTube.
- No compra entradas, no hace login, no salta fila y no evade captcha.

## Instalación

```bash
npm install
npx playwright install
```

## Configuración

1. Copiá `.env.example` a `.env`
2. Revisá `MONITOR_URL` y dejalo apuntando al show de María Becerra
3. Ajustá, si querés, `PLAYWRIGHT_USER_DATA_DIR` y los parámetros de audio
4. No bajes `CHECK_INTERVAL_MS` de `30000`

## Ejecución

```bash
npm run dev
```

O:

```bash
npm run monitor
```

Compilado:

```bash
npm run build
npm start
```

Tests livianos:

```bash
npm test
```

## Probar el detector sin esperar la página real

El parser puro `parseDateCardText(rawText)` se prueba con `node:test`, así que podés validar la lógica de fechas sin abrir Movistar Arena.

```bash
npm test
```

Si querés probarlo manualmente, el texto esperado es algo como:

```text
20 Noviembre 19:00 hs Puertas 21:00 hs Show Comprar
23 Noviembre 19:00 hs Puertas 21:00 hs Show Agotado
```

El primero debe dar match; el segundo no.

## Configurar parlantes

El proyecto incluye `scripts/set-speakers.ps1`, que intenta configurar la salida de audio y el volumen en Windows usando el módulo **AudioDeviceCmdlets**.

### Instalar el módulo

En PowerShell:

```powershell
Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser
```

### Listar dispositivos de audio

```bash
npm run list-audio-devices
```

Variables relevantes:

- `FORCE_SPEAKERS=true`
- `SPEAKER_DEVICE_NAME=Altavoces`
- `FORCE_SYSTEM_VOLUME=true`
- `SPEAKER_SCRIPT_PATH=scripts/set-speakers.ps1`

Ejemplo:

```env
SPEAKER_DEVICE_NAME=Altavoces
```

El valor puede coincidir con nombres como:

- `Altavoces`
- `Speakers`
- `Realtek Audio`
- `Monitor`
- `Headphones`

Si el módulo no está instalado, el script avisa con un mensaje claro y sale con código 1.

## Página objetivo

El monitor apunta al show de María Becerra en Movistar Arena. En esa página, la disponibilidad visible hoy usa el CTA `Comprar` para las fechas abiertas y `Agotado` para las cerradas. El bot **solo mira**; no hace click en comprar.

### Fallback opcional

Como alternativa documentada, también podés usar `SoundVolumeView.exe` de NirSoft para ajustar audio manualmente. No está implementado como requisito obligatorio en el bot; queda como fallback opcional si querés extenderlo después.

## Alarma y cooldown

Cuando se dispara la alarma, se guarda:

```json
{
  "firedAt": "...",
  "reason": "...",
  "matchedDate": {
    "day": "...",
    "month": "...",
    "time": "...",
    "rawText": "..."
  }
}
```

Si querés resetearla y permitir un nuevo disparo antes de que termine el cooldown, borrá:

```text
state/alarm-fired.json
```
