# Medilo · Sistema interno (Angular)

Aplicación para el personal del laboratorio (médicos, laboratoristas y administradores). Los pacientes
usan el portal en Flutter. La interfaz está en español y el código en inglés.

## Qué hace hoy

- **Inicio de sesión propio** contra `POST /api/v1/auth/login` y `GET /api/v1/me`. Si la cuenta es solo de
  paciente, se rechaza y no se guarda nada. La sesión vive en `sessionStorage` y termina sola cuando
  vence el token (15 minutos) o cuando la API responde 401.
- **Conocimiento clínico** (`/conocimiento`), el único módulo del backend que ya está completo de punta a punta:
  analitos, referencias validadas por fecha, borradores de referencia y de regla, y validación.

Se muestra u oculta cada pantalla según los permisos de `/me`, pero eso es solo experiencia de uso: el
backend autoriza cada solicitud.

| Permiso | Qué habilita |
|---|---|
| `conocimiento.leer` | Ver analitos y referencias |
| `conocimiento.administrar` | Crear analitos, borradores de referencia y reglas |
| `conocimiento.validar` | Validar borradores |

## Cómo correrlo

```bash
npm install
npm start        # http://localhost:4200
npm test         # pruebas unitarias (Vitest)
npm run build    # compilación de producción
```

`npm start` redirige `/api` al backend en `http://localhost:5000` (`proxy.conf.json`), así no hace falta
tocar CORS. Para apuntar a otro backend, cambia el `target` del proxy.

## Arquitectura

Organizada por funcionalidad (screaming) con capas limpias dentro de cada una. Las dependencias apuntan
hacia el dominio: `presentation → domain ← data`.

```
src/app/
  app.providers.ts   raíz de composición: qué adaptador implementa cada puerto
  app.interceptor.ts agrega el token y cierra la sesión ante un 401
  core/              errores, configuración, mapeo de errores HTTP
  shared/presentation/  átomos (banner, chip, logo) y textos de error en español
  shell/             marco de las páginas con sesión
  features/
    auth/ knowledge/ home/
      domain/        entidades, puertos, casos de uso y políticas (TypeScript puro, sin Angular)
      data/          repositorios HTTP y almacenamiento
      presentation/  páginas (contenedores) y widgets (presentacionales)
```

Para cambiar un backend o un almacenamiento se cambia una línea en `app.providers.ts`.

## Limitaciones del backend que se reflejan aquí

El backend aún no ofrece lo necesario para los demás módulos, por eso aparecen como «Próximamente»:

- No hay listados de órdenes, ni de pacientes, ni de tipos de prueba: registrar resultados o crear órdenes
  exige conocer los `id`.
- La API **no lista borradores** de referencias ni de reglas, ni fuentes. Por eso existe la pestaña
  «Borradores», que recuerda los creados en esta sesión del navegador y permite validar por `id`.
- En desarrollo, el formulario de referencias propone la fuente sintética de la semilla del backend
  (`f0000000-0000-4000-8000-000000000001`). En producción el campo queda vacío.

## Cuentas de prueba

Un backend con la migración `0007` (pendiente de merge, `APP_ENV` distinto de producción) trae `medico1@test.com`, `laboratorista1@test.com` y `admin1@test.com`, todas con `Password1`. Cada una ve solo los módulos de su rol.
