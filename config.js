export const SERVER_URL = process.env.NODE_ENV === 'production' 
    ? 'https://tu-dominio.com'
    : `http://${getLocalIP()}:3000`; 