class ChatApp {
    constructor() {
        this.conversations = [];
        this.currentConversation = null;
        this.serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : 'http://192.168.4.100:3000';
        
        this.init();
        this.initTheme();
    }

    init() {
        this.createNewChat();
        
        // Event listeners
        document.querySelector('.new-chat').addEventListener('click', () => this.createNewChat());
        document.querySelector('#send-button').addEventListener('click', () => this.sendMessage());
        document.querySelector('#message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Manejar el botón de historial en móvil
        const historyBtn = document.querySelector('.show-history-btn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                const history = document.querySelector('.chat-history');
                const isShowing = history.classList.contains('show');
                history.classList.toggle('show');
                historyBtn.textContent = isShowing ? 'Mostrar historial' : 'Ocultar historial';
            });
        }

        // Cerrar el historial al seleccionar una conversación en móvil
        document.querySelector('.chat-history').addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && e.target.classList.contains('conversation')) {
                document.querySelector('.chat-history').classList.remove('show');
                document.querySelector('.show-history-btn').textContent = 'Mostrar historial';
            }
        });

        // Manejar el menú móvil
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        const menuOverlay = document.querySelector('.menu-overlay');
        const closeButton = document.querySelector('.close-sidebar');

        menuToggle?.addEventListener('click', () => {
            sidebar.classList.add('active');
            menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        const closeSidebar = () => {
            sidebar.classList.remove('active');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        };

        closeButton?.addEventListener('click', closeSidebar);
        menuOverlay?.addEventListener('click', closeSidebar);

        // Cerrar el menú al seleccionar una opción en móvil
        document.querySelectorAll('.sidebar-content button, .provider-select')
            .forEach(element => {
                element.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        closeSidebar();
                    }
                });
            });

        // Ajustar al cambiar el tamaño de la ventana
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                closeSidebar();
            }
        });
    }

    initTheme() {
        // Configurar tema inicial basado en la hora
        this.setThemeByTime();
        
        // Actualizar tema cada hora
        setInterval(() => this.setThemeByTime(), 3600000);
        
        // Evento para cambio manual de tema
        document.getElementById('theme-toggle-btn').addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            this.setTheme(newTheme);
            localStorage.setItem('preferred-theme', newTheme);
        });
    }

    setThemeByTime() {
        const hour = new Date().getHours();
        const preferredTheme = localStorage.getItem('preferred-theme');
        
        // Si el usuario ha elegido manualmente un tema, respetarlo
        if (preferredTheme) {
            this.setTheme(preferredTheme);
            return;
        }

        // 7:00 AM - 7:00 PM = light theme
        // 7:00 PM - 7:00 AM = dark theme
        const theme = (hour >= 7 && hour < 19) ? 'light' : 'dark';
        this.setTheme(theme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        // Actualizar highlight.js tema si es necesario
        const codeTheme = theme === 'dark' ? 'atom-one-dark' : 'atom-one-light';
        document.querySelector('link[href*="highlight.js"]').href = 
            `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/${codeTheme}.min.css`;
    }

    async sendMessage() {
        const input = document.querySelector('#message-input');
        const message = input.value.trim();
        
        if (!message) return;

        try {
            const sendButton = document.querySelector('#send-button');
            sendButton.disabled = true;

            // Añadir mensaje del usuario al chat
            this.addMessageToChat('user', message);
            input.value = '';

            // Mostrar indicador de carga
            const loadingMessage = document.createElement('div');
            loadingMessage.classList.add('message', 'assistant', 'loading');
            loadingMessage.textContent = 'Escribiendo...';
            document.querySelector('.chat-messages').appendChild(loadingMessage);

            const response = await this.callClaudeAPI(message);
            loadingMessage.remove();

            if (response) {
                this.addMessageToChat('assistant', response);
                
                // Guardar en el historial de la conversación actual
                if (this.currentConversation) {
                    this.currentConversation.messages.push(
                        { role: 'user', content: message },
                        { role: 'assistant', content: response }
                    );
                }
            } else {
                throw new Error('No se recibió respuesta del servidor');
            }

        } catch (error) {
            console.error('Error completo:', error);
            const errorMessage = typeof error === 'object' ? 
                error.message || 'Error desconocido' : 
                error.toString();
            
            this.addMessageToChat('error', 
                `Hubo un error al procesar tu mensaje: ${errorMessage}`);
        } finally {
            document.querySelector('#send-button').disabled = false;
        }
    }

    async callClaudeAPI(message) {
        try {
            const provider = document.getElementById('ai-provider').value;
            const response = await fetch(`${this.serverUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    provider: provider,
                    conversationId: this.currentConversation?.id
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error en la API');
            }

            return data.message;
        } catch (error) {
            console.error('Error detallado:', error);
            throw error;
        }
    }

    addMessageToChat(role, content) {
        const messagesDiv = document.querySelector('.chat-messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role);

        if (role === 'assistant') {
            // Configurar marked para usar highlight.js y manejar enlaces
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true,
                gfm: true,
                renderer: new marked.Renderer()
            });

            // Personalizar el renderizado de enlaces
            const renderer = new marked.Renderer();
            
            // Procesar referencias de Perplexity [n]
            const provider = document.getElementById('ai-provider').value;
            if (provider === 'perplexity') {
                // Buscar las URLs en el contenido
                const urls = content.match(/\[(\d+)\]: (https?:\/\/[^\s]+)/g);
                const urlMap = {};
                
                if (urls) {
                    urls.forEach(url => {
                        const [_, num, link] = url.match(/\[(\d+)\]: (https?:\/\/[^\s]+)/);
                        urlMap[num] = link.trim();
                    });
                }

                // Reemplazar referencias [n] con enlaces
                content = content.replace(/\[(\d+)\](?!\:)/g, (match, num) => {
                    if (urlMap[num]) {
                        return `[${num}](${urlMap[num]})`;
                    }
                    return match;
                });

                // Limpiar las URLs del final del mensaje
                content = content.replace(/\[\d+\]: https?:\/\/[^\s]+\n?/g, '');
            }

            renderer.link = function(href, title, text) {
                const isPerplexityRef = /^\[\d+\]$/.test(text);
                return `<a href="${href}" 
                          title="${title || (isPerplexityRef ? 'Ver fuente' : text)}" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="${isPerplexityRef ? 'reference-link' : ''}">${text}</a>`;
            };

            marked.setOptions({ renderer });

            // Contenedor para el efecto de escritura
            const contentElement = document.createElement('div');
            contentElement.classList.add('markdown-content');
            messageElement.appendChild(contentElement);

            // Contenedor para el botón de copiar todo
            const copyAllContainer = document.createElement('div');
            copyAllContainer.className = 'copy-all-container';
            
            const copyAllButton = document.createElement('button');
            copyAllButton.className = 'copy-all-button';
            copyAllButton.innerHTML = `
                <svg class="copy-icon" viewBox="0 0 24 24">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                Copiar todo
            `;
            
            copyAllButton.addEventListener('click', async () => {
                await navigator.clipboard.writeText(content);
                copyAllButton.classList.add('copied');
                copyAllButton.innerHTML = `
                    <svg class="copy-icon" viewBox="0 0 24 24">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                    ¡Copiado!
                `;
                
                setTimeout(() => {
                    copyAllButton.classList.remove('copied');
                    copyAllButton.innerHTML = `
                        <svg class="copy-icon" viewBox="0 0 24 24">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                        Copiar todo
                    `;
                }, 2000);
            });

            copyAllContainer.appendChild(copyAllButton);
            messageElement.appendChild(copyAllContainer);

            // Efecto de escritura
            let index = 0;
            const speed = 10;
            const text = content;
            
            function typeWriter() {
                if (index < text.length) {
                    const currentText = text.substring(0, index + 1);
                    contentElement.innerHTML = marked.parse(currentText);
                    
                    // Asegurarse de que todos los enlaces se abran en una nueva pestaña
                    contentElement.querySelectorAll('a').forEach(link => {
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'noopener noreferrer');
                    });
                    
                    // Añadir botones de copiar a los bloques de código
                    contentElement.querySelectorAll('pre').forEach((pre) => {
                        if (!pre.querySelector('.copy-button')) {
                            const button = document.createElement('button');
                            button.className = 'copy-button';
                            button.innerHTML = `
                                <svg class="copy-icon" viewBox="0 0 24 24">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                                Copiar
                            `;
                            
                            button.addEventListener('click', async () => {
                                const code = pre.querySelector('code').innerText;
                                await navigator.clipboard.writeText(code);
                                
                                button.classList.add('copied');
                                button.innerHTML = `
                                    <svg class="copy-icon" viewBox="0 0 24 24">
                                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                                    </svg>
                                    Copiado!
                                `;
                                
                                setTimeout(() => {
                                    button.classList.remove('copied');
                                    button.innerHTML = `
                                        <svg class="copy-icon" viewBox="0 0 24 24">
                                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                        </svg>
                                        Copiar
                                    `;
                                }, 2000);
                            });
                            
                            pre.appendChild(button);
                        }
                    });
                    
                    // Resaltar código
                    contentElement.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                    
                    index++;
                    setTimeout(typeWriter, speed);
                }
            }
            
            typeWriter();
        } else {
            messageElement.textContent = content;
        }

        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    createNewChat() {
        // Limpiar el historial anterior en el servidor
        if (this.currentConversation) {
            fetch(`${this.serverUrl}/api/clear-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: this.currentConversation.id
                })
            });
        }

        const conversation = {
            id: Date.now(),
            messages: []
        };
        
        this.conversations.push(conversation);
        this.currentConversation = conversation;
        
        // Limpiar mensajes anteriores
        document.querySelector('.chat-messages').innerHTML = '';
        
        // Añadir a la lista de conversaciones
        this.updateConversationsList();
    }

    updateConversationsList() {
        const historyDiv = document.querySelector('.chat-history');
        historyDiv.innerHTML = '';
        
        this.conversations.forEach(conv => {
            const convElement = document.createElement('div');
            convElement.classList.add('conversation');
            convElement.textContent = `Conversación ${new Date(conv.id).toLocaleTimeString()}`;
            convElement.onclick = () => this.loadConversation(conv);
            historyDiv.appendChild(convElement);
        });
    }

    loadConversation(conversation) {
        this.currentConversation = conversation;
        // Implementar la carga de mensajes de la conversación
    }

    addCopyButtonToMessage(messageElement, text) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 24 24">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copiar
        `;
        
        button.addEventListener('click', async () => {
            await navigator.clipboard.writeText(text);
            button.classList.add('copied');
            button.innerHTML = `
                <svg class="copy-icon" viewBox="0 0 24 24">
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                </svg>
                Copiado!
            `;
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = `
                    <svg class="copy-icon" viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copiar
                `;
            }, 2000);
        });
        
        messageElement.appendChild(button);
    }
}

// Iniciar la aplicación
new ChatApp(); 