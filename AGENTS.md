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
6. **Contraste AA**: todo texto debe cumplir WCAG AA (4.5:1); los tokens ya están calibrados y se pinchan con el test de Flutter. No los aclares.

## Diseño y experiencia (heurísticas de Nielsen)

- Paleta: naranja de marca + **azul** (`--blue`, `--blue-deep`, `--blue-text`, `--blue-soft`, `--blue-tint`; mismos valores que Flutter). Azul para información, encabezados de tabla y acciones secundarias (`.btn--dark`); naranja para la acción principal.
- **Una sola página, como el portal**: el marco (`shell/staff-shell.ts`) pone el fondo continuo de cálido a frío con los círculos naranjas y azules; el contenido va en "islas" blancas redondeadas (`.card`, sombra `--shadow-island`), los títulos de sección llevan la línea (`.eyebrow`, `.section-label`) y el modal compartido (`organisms/modal.ts`) cierra el panel naranja con una franja azul. Los botones secundarios son azules (`.btn`), el naranja queda para la acción principal (`.btn--primary`) y el foco de campos y enlaces es azul.
- **Toda tabla pagina**: `PageState` + `<app-paginator>`, por defecto **5** filas (5, 10 o 20). No pegues una tabla sin paginador.
- **Mensajes**: amigables y accionables; `ErrorView` ya no lleva códigos de soporte y no se muestran ids técnicos. Un listado que falla ofrece "Reintentar"; un estado vacío dice qué hacer después.

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

- Errores `application/problem+json` con `correlation_id` → `ErrorKind` (mismo conjunto que Flutter: `invalidCredentials, unauthenticated, forbidden, notFound, conflict, validation, rateLimited, network, unavailable, readOnly, notPatient, unknown`; `readOnly` es el 503 con `code: READ_ONLY_MODE`, cuando la base principal no responde). Muestra el `correlation_id` como código de soporte.
- JWT HS256 de 15 min, sin refresh ni revocación: 401 ⇒ cerrar sesión y volver a login.
- 502/503/504 (backend caído tras el proxy) ⇒ `unavailable`.
- Desarrollo: `proxy.conf.json` apunta a `localhost:5000`.

### Brechas conocidas del backend

- Ya hay listados de órdenes (`GET /lab/orders`: el médico ve las que ordenó; el laboratorista recibe 403 y abre la orden por id), de cuentas (`GET /users`, módulo **Usuarios y roles**) y de borradores de conocimiento (`GET /knowledge/rules?estado=BORRADOR` y `GET /knowledge/references?estado=BORRADOR&analito_id=…`; los borradores de referencias exigen el analito, así que se piden analito por analito). `GET /patients` (solo los pacientes del médico) ya alimenta el combo con búsqueda del formulario de orden; `GET /lab/test-types` (catálogo de pruebas activas) se muestra como casillas de verificación, como la solicitud en papel. `GET /lab/worklist` (cola pendiente del laboratorio, ambos orígenes, urgentes primero, con el nombre de cada prueba) alimenta la cola de trabajo. `GET /lab/test-types/{id}/analytes` da los analitos de una prueba, con `obligatorio` y orden de presentación, y precarga el formulario de resultados. `/me` es mínimo.
- `GET /appointments` (agenda del médico) ya alimenta la agenda médica para el rol MEDICO (hora de sucursal UTC-5, paginador y filtro por estado).
- El listado de órdenes no trae prioridad ni pruebas, y `GET /lab/orders/{id}/documents` lista los informes subidos de una orden (metadatos; el archivo sale por `GET /documents/{id}/download`). El personal ve el informe registrado; la descarga la hace el paciente desde el portal. El laboratorio cierra la orden con `POST /lab/orders/{id}/confirm` (con o sin informe, cuando todas las pruebas tienen resultados). Después la orden no admite cambios (resultados ni informes) y sale de la cola. El correo de resultados se envía al confirmar, con el informe subido si existe. Al confirmar, el backend también genera el PDF de resultados con la plantilla Medilo y lo guarda como documento de la orden (en Mongo con `DOCUMENT_STORAGE=mongo`); aparece en la lista de informes y se descarga igual. Subir un informe propio sigue siendo opcional.
- **El laboratorista no puede leer una orden** (`GET /lab/orders/{id}` devuelve 403: solo el médico dueño y el paciente). Trabaja desde la cola: elige la orden y la pantalla abre la prueba pendiente con sus analitos obligatorios precargados. Al guardar vuelve a la cola. Si no tiene permiso de la cola, mantiene el campo por identificador.
- La orden pasa a `COMPLETADA` cuando todas sus pruebas tienen resultados, no al revisarla; la revisión médica se registra una vez y el estado no la refleja (un segundo intento da 409).
- Un usuario con rol MEDICO creado por `POST /users` no tiene perfil profesional y no puede crear órdenes.
- **Examen pedido por el paciente, sin médico** (`POST /lab/patient-orders`, origen `PACIENTE`, `medico_id` nulo, prioridad NORMAL). Ya existe en el backend y aparece en la cola del laboratorio. Esta app no lo crea: es del portal del paciente (Flutter), que todavía no lo consume. Estas órdenes no tienen revisión ni propuesta del médico.
- **Aprobación de cancelaciones: listado de citas confirmadas, no de solicitudes**: `GET /api/v1/appointments/cancellation-approvals` (solo `citas.revisar_cancelaciones`) lista las citas `CONFIRMADA` para pre-autorizar su cancelación fuera de cupo o plazo. Cada fila trae solo la identidad del médico (`medico`: id, nombre y `registro_profesional`) y `tiene_aprobacion`. No trae paciente ni teléfono, y filtra por `medico_registro` exacto. El backend no guarda solicitudes de cancelación pendientes, así que no hay una bandeja de solicitudes; si producto la necesita, hay que pedirla al equipo de backend como cambio de modelo. La pantalla pide hasta 100 citas por búsqueda y avisa cuando el resultado llega al tope.
- **Paciente: contacto del médico**: `GET /api/v1/appointments` devuelve, en las citas del paciente, `medico` con `id`, `nombre`, `registro_profesional` y `telefono`, para que pueda comunicarse con su médico. El portal del paciente (Flutter) aún no muestra este bloque; es pendiente de ese cliente.
- **Descarga de informes PDF en el personal**: `GET /documents/{id}/download` devuelve el binario `application/pdf`. El botón "Descargar" por documento en el detalle de la orden descarga el informe como Blob autenticado por HttpClient sin exponer tokens ni URLs en etiquetas `<a>`, manejando errores 404/403 con `describeError` y sin exponer `correlation_id`.

Documéntalas aquí y en el README cuando una funcionalidad dependa de ellas; quítalas cuando el backend las cierre.

### Hallazgos en sombra (detalle de la orden)

- Panel `app-shadow-panel` (`orders/presentation/pages/shadow-panel.ts`), con puerto propio `ShadowRepository`. Solo lo ve quien tiene `resultados.leer_con_acceso`; guardar instantánea y actuar sobre un hallazgo exigen `revisiones.registrar` y ser el médico que ordenó.
- Lectura en vivo (`GET /sombra`, no guarda nada) → instantánea inmutable (`POST /sombra/snapshots`) → acción por hallazgo (`CONFIRMAR`, `DESCARTAR` o `MODIFICAR`, siempre con motivo ≤500) con historial append-only. Nada de esto cambia la orden ni la propuesta.
- Las categorías permitidas para `MODIFICAR` están duplicadas en `shadow-policies.ts` (el backend manda; esto solo evita un viaje).
- El contrato OpenAPI tipa la respuesta de `/sombra` como `object`: la forma real se tomó del código del backend (`routes.py`, `domain/shadow.py`) y se **verificó contra el backend real** con una orden sintética (lectura, instantánea, acción `MODIFICAR` con historial; validación del cliente). Sin probar: `CONFIRMAR`/`DESCARTAR`, los 403/409 reales y el ancho móvil.

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
