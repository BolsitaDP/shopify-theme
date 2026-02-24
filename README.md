# Desarrollo de tema Shopify (koromen)

Guia rapida de comandos para trabajar este tema en local con Shopify CLI.

## Requisitos

- Tener instalado Shopify CLI
- Tener acceso a `koromen.myshopify.com`
- Haber iniciado sesion con `shopify auth login` (o al correr un comando)

## Tienda

Usaremos este store en los ejemplos:

```powershell
koromen.myshopify.com
```

## Comandos principales

## 1. Levantar entorno local (preview con hot reload)

```powershell
shopify theme dev --store koromen.myshopify.com
```

- Abre una vista previa del tema
- Refresca cambios automaticamente
- Ideal para desarrollo diario

## 2. Traer cambios del tema desde Shopify (pull)

```powershell
shopify theme pull --store koromen.myshopify.com
```

Si quieres elegir un tema especifico:

```powershell
shopify theme list --store koromen.myshopify.com
shopify theme pull --store koromen.myshopify.com --theme <THEME_ID>
```

## 3. Subir cambios a Shopify (push)

```powershell
shopify theme push --store koromen.myshopify.com
```

Subir a un tema especifico:

```powershell
shopify theme push --store koromen.myshopify.com --theme <THEME_ID>
```

## 4. Ver temas disponibles

```powershell
shopify theme list --store koromen.myshopify.com
```

## 5. Publicar un tema (usar con cuidado)

```powershell
shopify theme publish --store koromen.myshopify.com --theme <THEME_ID>
```

## 6. Abrir el editor / preview del tema

```powershell
shopify theme open --store koromen.myshopify.com
```

## 7. Revisar errores del tema (Theme Check)

```powershell
shopify theme check
```

## 8. Ignorar archivos en push/pull (opcional)

Ejemplo de push sin subir configuraciones sensibles:

```powershell
shopify theme push --store koromen.myshopify.com --ignore config/settings_data.json
```

## Autenticacion (si vuelve a fallar)

Cerrar sesion y volver a autenticar:

```powershell
shopify auth logout
shopify theme dev --store koromen.myshopify.com
```

## Flujo recomendado de trabajo

1. Hacer pull del tema base
2. Ejecutar `shopify theme dev --store koromen.myshopify.com`
3. Editar archivos en `sections/`, `snippets/`, `assets/`, `templates/`
4. Validar con `shopify theme check`
5. Subir cambios con `shopify theme push --store koromen.myshopify.com`

## Git (recomendado)

Inicializar repo y guardar primer pull:

```powershell
git init
git add .
git commit -m "Initial theme pull"
```

Comandos utiles:

```powershell
git status
git diff
git add .
git commit -m "Describe tu cambio"
```

## Notas

- Evita editar directamente el tema publicado en produccion.
- Ten cuidado con `config/settings_data.json` porque contiene configuracion del tema.
- Si trabajas en equipo, acuerden si haran `pull` antes de cada `push`.
