const cors_proxy = require('cors-anywhere');

const host = '0.0.0.0';
const port = 8080;

cors_proxy.createServer({
    originWhitelist: [], // Permite todos los orígenes
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
    console.log('Servidor CORS proxy corriendo en ' + host + ':' + port);
}); 