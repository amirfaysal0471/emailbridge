/**
 * Vercel serverless entry point.
 *
 * The whole Express app runs as one function behind /api/*. Serving it from the
 * same Vercel project as the React build means browser and API share an origin,
 * which is what keeps the session cookie working without SameSite=None and
 * removes CORS from the picture entirely.
 */
import { createApp } from '../backend/dist/app.js'

export default createApp();
