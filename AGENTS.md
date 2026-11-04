# AGENTS.md — Sistema del personal (Angular)

Guía obligatoria para cualquier agente o persona que modifique este repo. Este front es **el sistema interno del
personal** (laboratoristas, médicos, administradores); el portal público del paciente vive en `../frontend-flutter`.
Ambos deben verse y comportarse como un solo producto.

## Reglas de oro

1. **No se toca el backend** (`../MedicalBooking-AD-Backend`). El contrato es `docs/api/openapi.json`. Si falta algo, se documenta como brecha, no se inventa.
2. **Idioma**: interfaz en español; código, identificadores, comentarios y commits en inglés.
3. **Mismas guías de estilo que Flutter**: paleta naranja y componentes equivalentes. Los tokens viven en `src/styles.scss`; si cambias uno, cámbialo también en `../frontend-flutter/lib/core/design/tokens.dart`.
4. **Paridad de comportamiento** con Flutter: mismos tipos de error, mismo manejo de 401, mismos textos para el mismo caso.
5. Cada app tiene su propio login. No se pasan tokens entre apps. Cada una valida el rol: aquí solo personal; una cuenta `PACIENTE` se rechaza con un mensaje que lo dirige al portal.

## Arquitectura

Feature-first con Clean Architecture dentro de cada feature. Dependencia hacia adentro: `presentation -> domain <- data`.

```
src/app/core/             http, errores, utilidades
src/app/shared/presentation/  componentes reutilizables (atoms / molecules / organisms)
src/app/shell/            layout de la aplicación
src/app/features/<f>/{domain,data,presentation}
src/app/app.providers.ts  única raíz de composición
src/app/app.interceptor.ts  agrega el bearer y cierra sesión ante 401
```

- `domain`: entidades, puertos, casos de uso (TypeScript puro, sin Angular).
- `data`: implementaciones HTTP; traducen DTOs del backend (español, snake_case) a entidades en inglés.
- `presentation`: contenedores (páginas, con `inject`) vs presentacionales (solo `input()`/`output()`).
- Standalone components, signals y zoneless. Nadie fuera de `app.providers.ts` enlaza puertos con implementaciones.
- Guards: `auth`, `guest`, `permission`. Los permisos solo mejoran la UX; la autorización real es del backend.
- La navegación y la página de inicio salen de un solo catálogo (`shell/app-modules.ts`): a cada rol solo se le muestra lo que puede usar, ni siquiera como "próximamente". Un módulo nuevo se registra ahí con sus permisos.

## Contrato con el backend

- Errores `application/problem+json` con `correlation_id` → `ErrorKind` (mismo conjunto que Flutter: `invalidCredentials, unauthenticated, forbidden, notFound, conflict, validation, rateLimited, network, unavailable, notPatient, unknown`). Muestra el `correlation_id` como código de soporte.
- JWT HS256 de 15 min, sin refresh ni revocación: 401 ⇒ cerrar sesión y volver a login.
- 502/503/504 (backend caído tras el proxy) ⇒ `unavailable`.
- Desarrollo: `proxy.conf.json` apunta a `localhost:5000`.

### Brechas conocidas del backend

Sin listados de citas/órdenes, sin catálogo, sin confirmación de pago, `/me` mínimo, sin listado de borradores de conocimiento. Documéntalas aquí y en el README cuando una funcionalidad dependa de ellas; quítalas cuando el backend las cierre.

## Seguridad

- Sesión en `sessionStorage`, nunca `localStorage`. Ningún token en URLs.
- Redirecciones post-login solo internas (`safeRedirect`).
- Hay un hook que bloquea contraseñas literales: usa valores aleatorios o variables en mocks y tests.

## Definición de terminado

1. `npm test` (`ng test`, Vitest) en verde.
2. `npm run build` compila.
3. Para cambios visuales o de flujo: revisar en navegador, también en ancho móvil.
4. **Sé honesto**: si solo verificaste contra un mock del contrato, dilo.
5. Pruebas nuevas: una por regla, por la interfaz pública.

## Git

- Ramas `feat/…`, `fix/…`; Conventional Commits en inglés, **sin** atribución a IA.
- PR hacia `develop` con descripción en español. No hagas push ni abras PR sin que te lo pidan.

## Checklist de paridad con Flutter

- [ ] Tokens de diseño idénticos
- [ ] Mismos `ErrorKind` y textos
- [ ] Mismo manejo de 401/expiración
- [ ] Mismas capas y nombres de feature
- [ ] Mismas brechas documentadas en ambos README
