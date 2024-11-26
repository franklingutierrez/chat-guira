# GUIRATEC Chat AI
![image](https://github.com/user-attachments/assets/753e7a78-f39c-40d4-9f08-c98300ec7e32)

## Configuración

1. Clona el repositorio
2. Copia el archivo de ejemplo de variables de entorno:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` y añade tus API keys:
   - CLAUDE_API_KEY: Tu API key de Anthropic Claude
   - OPENAI_API_KEY: Tu API key de OpenAI
   - PERPLEXITY_API_KEY: Tu API key de Perplexity

4. Instala las dependencias:
   ```bash
   npm install
   ```

5. Inicia el servidor:
   ```bash
   npm start
   ```

## Seguridad

- Nunca subas el archivo `.env` a GitHub
- Mantén tus API keys seguras
- Usa variables de entorno para las claves sensibles
