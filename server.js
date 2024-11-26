import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Obtener el directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(__dirname));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

const PORT = 3000;

// Almacenar el historial de conversaciones
const conversationHistory = new Map();

const API_KEYS = {
    claude: process.env.CLAUDE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY
};

// Verificar que todas las API keys estén presentes
const requiredKeys = ['CLAUDE_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY'];
const missingKeys = requiredKeys.filter(key => !process.env[key]);

if (missingKeys.length > 0) {
    console.error('Error: Faltan las siguientes variables de entorno:', missingKeys);
    process.exit(1);
}

const API_ENDPOINTS = {
    claude: 'https://api.anthropic.com/v1/messages',
    openai: 'https://api.openai.com/v1/chat/completions',
    perplexity: 'https://api.perplexity.ai/chat/completions'
};

async function callClaudeAPI(message, conversationId) {
    const history = conversationHistory.get(conversationId) || [];
    console.log('Enviando historial a Claude:', history); // Debug

    const response = await fetch(API_ENDPOINTS.claude, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': API_KEYS.claude
        },
        body: JSON.stringify({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            system: "Eres un asistente útil que siempre responde usando Markdown.",
            messages: [
                ...history.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: message
                }
            ]
        })
    });
    return response;
}

async function callOpenAIAPI(message, conversationId) {
    const history = conversationHistory.get(conversationId) || [];
    console.log('Enviando historial a OpenAI:', history); // Debug

    const response = await fetch(API_ENDPOINTS.openai, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEYS.openai}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-2024-08-06',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un asistente útil que siempre responde usando Markdown.'
                },
                ...history,
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        })
    });
    return response;
}

async function callPerplexityAPI(message, conversationId) {
    const history = conversationHistory.get(conversationId) || [];
    console.log('Enviando historial a Perplexity:', history); // Debug

    const response = await fetch(API_ENDPOINTS.perplexity, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEYS.perplexity}`
        },
        body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un asistente útil que siempre responde usando Markdown.'
                },
                ...history,
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 4000,
            temperature: 0.7
        })
    });
    return response;
}

app.post('/api/chat', async (req, res) => {
    try {
        const { message, provider, conversationId } = req.body;
        let response;
        let data;

        console.log(`Procesando solicitud para ${provider}:`, message);

        // Obtener el historial actual
        let history = conversationHistory.get(conversationId) || [];
        console.log('Historial actual:', history); // Debug

        switch (provider) {
            case 'claude':
                response = await callClaudeAPI(message, conversationId);
                data = await response.json();
                if (!response.ok) throw new Error(data.error?.message || 'Error con Claude API');
                
                // Actualizar historial para Claude
                history.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: data.content[0].text }
                );
                // Guardar el historial actualizado
                conversationHistory.set(conversationId, history);
                
                return res.json({ 
                    message: data.content[0].text,
                    provider: 'Claude'
                });

            case 'openai':
                response = await callOpenAIAPI(message, conversationId);
                data = await response.json();
                if (!response.ok) throw new Error(data.error?.message || 'Error con OpenAI API');
                
                // Actualizar historial
                history.push({ role: 'user', content: message });
                history.push({ role: 'assistant', content: data.choices[0].message.content });
                // Guardar el historial actualizado
                conversationHistory.set(conversationId, history);
                
                return res.json({ 
                    message: data.choices[0].message.content,
                    provider: 'OpenAI (GPT-4o)'
                });

            case 'perplexity':
                response = await callPerplexityAPI(message, conversationId);
                data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error?.message || 'Error con Perplexity API');
                }

                if (data.choices && data.choices[0] && data.choices[0].message) {
                    // Actualizar historial
                    history.push({ role: 'user', content: message });
                    history.push({ role: 'assistant', content: data.choices[0].message.content });
                    // Guardar el historial actualizado
                    conversationHistory.set(conversationId, history);
                    
                    return res.json({ 
                        message: data.choices[0].message.content,
                        provider: 'Perplexity (Llama 3.1)'
                    });
                } else {
                    throw new Error('Formato de respuesta inesperado de Perplexity');
                }

            default:
                throw new Error('Proveedor de IA no válido');
        }

    } catch (error) {
        console.error('Error detallado:', error);
        res.status(500).json({
            error: error.message || 'Error interno del servidor',
            details: error.toString()
        });
    }
});

// Endpoint para limpiar el historial
app.post('/api/clear-history', (req, res) => {
    const { conversationId } = req.body;
    conversationHistory.delete(conversationId);
    res.json({ message: 'Historial limpiado exitosamente' });
});

// Añadir endpoint para obtener el historial
app.get('/api/history/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    const history = conversationHistory.get(conversationId) || [];
    res.json({ history });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://192.168.4.100:${PORT}`);
    console.log('También disponible en:');
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Red: http://192.168.4.100:${PORT}`);
}); 