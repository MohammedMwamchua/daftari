# Daftari (manager app, design prototype)

Run it:

    npm install
    npm run dev

Files:
- src/App.jsx    all screens (Leo, Funga siku, Wafanyakazi, Fedha) and the sample data in seed()
- src/styles.css design tokens (light and dark) and all styles
- src/exporters.js CSV and PDF downloads
- src/main.jsx   entry point

Icons come from react-icons (Phosphor). Fonts (Bricolage Grotesque and IBM Plex Sans) load from Google Fonts in index.html.

Next steps for the real system:
- Replace seed() and the `act` handlers in App() with calls to your Django REST API.
- Text is written as t('Kiswahili', 'English') next to each label. Move it to a translation file when you are ready.
- Closed days must be locked on the server too, not only on the screen.
