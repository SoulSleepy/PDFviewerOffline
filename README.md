# React + TypeScript + Vite

📄 Simple PDF Viewer (React + TypeScript)

Лёгкий standalone/viewer для PDF на базе react-pdf-viewer
Работает прямо в браузере без сервера — один HTML/JS-бандл можно встроить куда угодно (iframe, CMS, сайт).
Возможности

Открытие PDF с компьютера (drag & drop или через кнопку)

Загрузка PDF в iframe через postMessage (pdf-url, pdf-bytes, pdf-blob, clear-pdf)

Поиск по документу

Масштабирование (zoom in/out, pinch-zoom для iOS)

Переход по страницам

Скачивание с выбором имени

Поделиться ссылкой (share-link / share-config)

Полный экран (нативный и CSS fallback)

iOS-friendly (поддержка жестов и корректная работа fullscreen)
Использование

Соберите проект → получите один index.html с вшитым воркером.

Вставьте в любую страницу через iframe:
```<iframe src="/pdf-viewer/index.html" width="100%" height="600"></iframe>```
Либо просто откройте index.html в браузере — работает автономно.
Подходит для

Встраивания PDF-читалки в любое приложение (Next.js, Django, WordPress, etc.)

Простого шаринга документов без установки ПО

Использования оффлайн (просто открыть локальный index.html)
П.С. Внутри есть уникальные вещи не нужные вам, но это и так чисто для себя опубликовано, однако вещь полезная.
