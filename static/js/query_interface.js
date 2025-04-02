/**
 * Initialize the query interface
 */
function initQueryInterface() {
    const queryForm = document.getElementById('query-form');
    const queryInput = document.getElementById('query-input');
    const conversationContainer = document.getElementById('conversation');
    const newConversationBtn = document.getElementById('new-conversation');
    const conversationIdSpan = document.getElementById('conversation-id');
    
    if (!queryForm || !conversationContainer) return;
    
    // Generate or retrieve conversation ID
    let conversationId = localStorage.getItem('currentConversationId');
    if (!conversationId) {
        conversationId = generateConversationId();
        localStorage.setItem('currentConversationId', conversationId);
    }
    
    // Display truncated conversation ID
    if (conversationIdSpan) {
        conversationIdSpan.textContent = 'ID: ' + conversationId.substring(0, 8) + '...';
    }
    
    // Load previous conversation if it exists
    loadConversation(conversationId);
    
    // Handle new conversation button
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', function() {
            // Clear conversation display
            while (conversationContainer.firstChild) {
                if (conversationContainer.firstChild.classList && 
                    conversationContainer.firstChild.classList.contains('system-message')) {
                    break;
                }
                conversationContainer.removeChild(conversationContainer.firstChild);
            }
            
            // Generate new conversation ID
            conversationId = generateConversationId();
            localStorage.setItem('currentConversationId', conversationId);
            
            // Update display
            conversationIdSpan.textContent = 'ID: ' + conversationId.substring(0, 8) + '...';
        });
    }
    
    // Handle query submission
    queryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const query = queryInput.value.trim();
        if (!query) return;
        
        // Add user message to conversation
        addMessageToConversation('user', query);
        
        // Clear input
        queryInput.value = '';
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'assistant-message loading';
        loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"><span class="visually-hidden">Loading...</span></div> Processing your query...';
        conversationContainer.appendChild(loadingDiv);
        
        // Scroll to bottom
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
        
        // Send query to server
        fetch('/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                conversation_id: conversationId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Remove loading indicator
            conversationContainer.removeChild(loadingDiv);
            
            // Add response to conversation
            addMessageToConversation('assistant', data.response, data.citations);
        })
        .catch(error => {
            // Remove loading indicator
            conversationContainer.removeChild(loadingDiv);
            
            // Add error message
            addMessageToConversation('assistant', 'Sorry, there was an error processing your request: ' + error.message);
        });
    });
    
    /**
     * Load previous conversation from server
     */
    function loadConversation(conversationId) {
        fetch(`/conversation/${conversationId}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                // Clear default messages except system message
                while (conversationContainer.firstChild) {
                    if (conversationContainer.firstChild.classList && 
                        conversationContainer.firstChild.classList.contains('system-message')) {
                        break;
                    }
                    conversationContainer.removeChild(conversationContainer.firstChild);
                }
                
                // Add messages
                data.forEach(message => {
                    addMessageToConversation(
                        message.role === 'user' ? 'user' : 'assistant',
                        message.content,
                        message.citations || []
                    );
                });
            }
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
        });
    }
    
    /**
     * Generate a random conversation ID
     */
    function generateConversationId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

/**
 * Add a message to the conversation
 */
function addMessageToConversation(role, message, citations = []) {
    const conversationContainer = document.getElementById('conversation');
    if (!conversationContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = role + '-message';
    
    // Add message text
    const messageP = document.createElement('p');
    messageP.textContent = message;
    messageDiv.appendChild(messageP);
    
    // Add citations if available
    if (citations && citations.length > 0) {
        const citationsDiv = document.createElement('div');
        citationsDiv.className = 'citations';
        
        citations.forEach((citation, index) => {
            const citationSpan = document.createElement('span');
            citationSpan.className = 'citation';
            citationSpan.textContent = `[${index + 1}] ${citation.snippet || 'Document reference'}`;
            citationSpan.dataset.index = index;
            
            // Create citation details
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'citation-details d-none';
            detailsDiv.innerHTML = `
                <strong>Title:</strong> ${escapeHtml(citation.title || 'Unknown')}<br>
                <strong>Authors:</strong> ${escapeHtml(citation.authors || 'Unknown')}<br>
                ${citation.journal ? `<strong>Journal:</strong> ${escapeHtml(citation.journal)}<br>` : ''}
                ${citation.doi ? `<strong>DOI:</strong> <a href="https://doi.org/${citation.doi}" target="_blank">${citation.doi}</a><br>` : ''}
                <strong>Reference:</strong> ${escapeHtml(citation.full_citation || 'No citation available')}
            `;
            
            // Toggle citation details
            citationSpan.addEventListener('click', function() {
                const isVisible = !detailsDiv.classList.contains('d-none');
                if (isVisible) {
                    detailsDiv.classList.add('d-none');
                } else {
                    // Hide all other citation details
                    document.querySelectorAll('.citation-details').forEach(el => {
                        el.classList.add('d-none');
                    });
                    detailsDiv.classList.remove('d-none');
                }
            });
            
            citationsDiv.appendChild(citationSpan);
            citationsDiv.appendChild(detailsDiv);
        });
        
        messageDiv.appendChild(citationsDiv);
    }
    
    conversationContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
}