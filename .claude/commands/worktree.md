---
description: Crea un worktree aislado en .trees/<name> y ejecuta ahí el requerimiento recibido
argument-hint: <requerimiento a ejecutar en el worktree>
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git rev-parse:*), Agent
---

# /worktree

Requerimiento recibido: $ARGUMENTS

Sigue estos pasos en orden.

## 1. Validar

Si el requerimiento está vacío, pídelo al usuario y detente. No crees nada.

## 2. Determinar el nombre

Deduce `name` a partir del requerimiento:

- kebab-case, solo ASCII (sin tildes ni `ñ`), de 2 a 4 palabras.
- Prefijo según el tipo de trabajo: `feat-`, `fix-`, `refactor-`, `docs-`, etc.
- Ejemplo: "agregar pieza fantasma" → `feat-ghost-piece`.

## 3. Evitar colisiones

Ejecuta `git worktree list` y `git branch --list`. Si `name` ya existe como rama o como directorio en `.trees/`, añade un sufijo numérico (`-2`, `-3`…) hasta que sea único.

## 4. Crear el worktree

Desde la raíz del repositorio (`git rev-parse --show-toplevel`):

```
git worktree add .trees/<name>
```

Sin `-b`, git crea la rama `<name>` a partir de `HEAD`. Si el comando falla, muestra el error al usuario y no continúes.

## 5. Ejecutar el requerimiento de forma aislada

Lanza un subagente `general-purpose` en segundo plano (`run_in_background: true`) con un prompt autocontenido que incluya:

- La ruta **absoluta** del worktree (`<raíz>/.trees/<name>`) como único directorio de trabajo. Todas las lecturas, ediciones y comandos deben usar rutas dentro de ella.
- El requerimiento literal: `$ARGUMENTS`.
- Estas reglas:
  - Leer y respetar el `CLAUDE.md` del worktree. No hay build, linter ni tests: no inventes comandos.
  - Si se cambian `COLS`, `ROWS` o `BLOCK`, mantener sincronizados los `width`/`height` de los canvas en `index.html`.
  - No leer ni modificar el checkout principal ni otros worktrees.
  - Hacer commits en la rama `<name>` del worktree. No hacer merge, push ni borrar ramas.
- Al terminar, el subagente debe reportar: archivos modificados, commits creados y cómo verificar el resultado (abrir el `index.html` del worktree en el navegador).

## 6. Informar al usuario

Responde en español y de forma breve con:

- `name`, ruta del worktree y rama creada.
- Que la tarea corre en segundo plano en ese worktree.
- Cómo revisar y limpiar:
  - Revisar: `git diff main...<name>`
  - Descartar: `git worktree remove .trees/<name>` y luego `git branch -D <name>`
