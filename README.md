````md
# React + TypeScript + Vite

📄 **Simple PDF Viewer (React + TypeScript)**

Лёгкий standalone PDF viewer на базе `react-pdf-viewer`.

Работает прямо в браузере и может быть собран в статический HTML/JS-бандл для встраивания куда угодно: в `iframe`, CMS, сайт, внутреннюю документацию или админку. Хорошо подходит для React и Next.js проектов, но в целом может использоваться в любых системах, где нужно просто открыть PDF в отдельном viewer.

## Возможности

- открытие PDF с компьютера
- загрузка PDF в `iframe` через `postMessage`
- поддержка `pdf-url`, `pdf-bytes`, `pdf-blob`, `clear-pdf`
- поиск по документу
- переход по страницам
- масштабирование
- fullscreen
- скачивание файла с выбором имени
- перемещение больших страниц мышью
- поддержка iOS-жестов
- удобное встраивание в другие приложения

## Поддерживаемые сценарии загрузки

Viewer умеет принимать PDF несколькими способами:

- через локальный выбор файла
- через URL
- через `Blob`
- через `ArrayBuffer`
- через сообщения из родительского окна при работе в `iframe`

## Использование

Соберите проект и получите готовый viewer, например:

`/pdf-viewer/index.html`

После этого его можно встроить в любую страницу через `iframe`:

```html
<iframe
    src="/pdf-viewer/index.html"
    width="100%"
    height="600"
    style="border: 0;"
    allow="fullscreen"
    allowfullscreen
></iframe>
````

Viewer также можно просто открыть как обычную статическую страницу в браузере.

## Встраивание через iframe

После загрузки viewer отправляет родителю сообщение:

```js
{ type: 'viewer-ready' }
```

После этого родительское приложение может передать PDF внутрь viewer через `postMessage`.

### Передача URL

```js
iframe.contentWindow.postMessage(
    {
        type: 'pdf-url',
        payload: 'https://example.com/file.pdf',
        name: 'document.pdf',
    },
    '*'
)
```

### Передача Blob

```js
iframe.contentWindow.postMessage(
    {
        type: 'pdf-blob',
        payload: pdfBlob,
        name: 'document.pdf',
    },
    '*'
)
```

### Передача ArrayBuffer

```js
iframe.contentWindow.postMessage(
    {
        type: 'pdf-bytes',
        payload: arrayBuffer,
        name: 'document.pdf',
    },
    '*'
)
```

### Очистка viewer

```js
iframe.contentWindow.postMessage(
    {
        type: 'clear-pdf',
    },
    '*'
)
```

## Fullscreen

Viewer поддерживает полноэкранный режим.

Если он открыт как обычная страница, используется стандартный fullscreen API браузера.

Если viewer встроен в `iframe`, он отправляет наружу события:

```js
{ type: 'pdfviewer:enter-fs' }
{ type: 'pdfviewer:exit-fs' }
```

В этом случае хост-приложение должно само обработать эти события и включить fullscreen для контейнера или `iframe`.

## Для чего подходит

* встраивание PDF-читалки в React и Next.js приложения
* интеграция в Django, WordPress и другие CMS
* просмотр документов во внутренних системах и админках
* документация и корпоративные порталы
* автономное использование как локального viewer
* оффлайн-сценарии, когда достаточно открыть готовый `index.html`

## Примечание

Внутри есть некоторые узкоспециальные вещи, которые могут быть не нужны в сторонних проектах. Репозиторий опубликован в первую очередь как практический и полезный инструмент, который можно адаптировать под свои задачи.

```
```
