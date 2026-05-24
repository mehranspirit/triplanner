# AI Provider Configuration

Server-side AI features can use Gemini or OpenAI through the shared provider in `server/services/aiProvider.js`.

## Environment Variables

Use `AI_PROVIDER` to choose the provider:

```env
AI_PROVIDER=gemini
```

or:

```env
AI_PROVIDER=openai
```

### Gemini

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL_PRIMARY=gemini-2.5-flash
```

`AI_MODEL_PRIMARY` is still supported as a fallback model name for Gemini.

### OpenAI

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL_PRIMARY=gpt-4o-mini
```

`AI_MODEL_PRIMARY` is supported as a fallback model name for OpenAI when `OPENAI_MODEL_PRIMARY` is not set.

## Notes

- Do not expose `OPENAI_API_KEY` in frontend `VITE_` variables.
- Existing deterministic fallbacks remain in place for assistant briefing flows that support them.
- Event parsing requires a configured provider key because it cannot fall back deterministically.
