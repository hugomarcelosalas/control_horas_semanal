# Control horario — versión online

Aplicación multiusuario para Render con Node.js + PostgreSQL.

## Funciones añadidas
- Empleados activos/no activos. Los inactivos no aparecen en la pantalla principal ni pueden iniciar sesión, pero conservan histórico y aparecen en dashboards.
- Los meses anteriores al actual quedan cerrados por defecto para los empleados. El admin puede abrir/cerrar el mes desde el calendario.
- Importación de exportaciones de Notion en ZIP o CSV desde Administración. Para cada empleado se importan las horas diarias (Entrada, Salida, Horas, hs extras, Día/fecha y Observaciones) y la lista semanal (Fecha/Desde-Hasta, Anterior, Contrato, Esta semana y Balance).
- Los CSV `_all` se filtran por el campo `Staff` cuando está presente.

## Render
El `render.yaml` crea el servicio web y PostgreSQL. Configura `ADMIN_PASSWORD` como secreto en Render. No pongas contraseñas dentro del código.
