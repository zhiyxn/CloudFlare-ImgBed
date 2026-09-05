import { checkDatabaseConfig } from '../utils/middleware';
import { handleCORS } from '../utils/cors.js';

export const onRequest = [handleCORS, checkDatabaseConfig];
