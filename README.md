# Screen Tender Assistant

A local web MVP that compares a tender PDF or pasted requirements with a product PDF (including scanned pages) or a public product webpage, using Gemini. It can read the assessment aloud.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install` in this folder.
3. Set `GEMINI_API_KEY` and `OPENROUTER_API_KEY` in the included `.env` file. Gemini is tried first; OpenRouter is the backup.
4. Run `npm start` and open <http://127.0.0.1:4173> in Chrome or Edge.
5. Upload the tender PDF (scanned PDFs are supported) or paste its requirements. Then upload a product PDF or provide its public webpage URL and compare.
6. Choose Auto, Gemini, or OpenRouter; select Fast, Balanced, or Deep Review; expand Advanced options for model preference and report detail.

## GitHub Pages

The root `index.html` is the GitHub Pages home page. The included Actions workflow packages it with the frontend assets from `public/`. For browser-only testing, enter test keys in **Run settings → Advanced options → Personal API keys**. They are stored in that browser's local storage and sent directly to Gemini or OpenRouter; they are not included in the public repository. GitHub Pages does not require the Express server for this mode. Clear the browser's saved keys when finished.

The app binds only to `127.0.0.1`. Tender and product PDFs are sent to the selected AI provider for analysis and are not saved by this app. Gemini is tried first. If Gemini fails, the app uses OpenRouter's `openai/gpt-4o` model; the result identifies which provider responded. For product URLs, the local server first extracts readable content from the public page, then uses Gemini URL Context or OpenRouter Web Fetch if needed. Pages that require a login may not work. Voice output uses the browser's speech synthesis.

## Notes

- Keep `.env` private; it is excluded by `.gitignore`.
- If a key has been exposed in chat or elsewhere, revoke it and create a fresh one before use.
- Each PDF upload is limited to 18 MB. Gemini can read both selectable text and scanned/image-only PDF pages. Verify critical values with the supplier.
- OpenRouter's scanned-PDF OCR engine may incur per-page charges on your OpenRouter account.
- The app uses Google's official `@google/genai` JavaScript SDK. It tries Gemini 3.8 Flash first, briefly retries transient errors, then falls back through Gemini 3.7 Flash, 3.6 Flash, and 3.5 Flash-Lite before switching providers.
