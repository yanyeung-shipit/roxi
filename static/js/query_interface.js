/**
 * Initialize the query interface
 */
function initQueryInterface() {
    const queryForm = document.getElementById('queryForm');
    const queryInput = document.getElementById('queryInput');
    const conversationContainer = document.getElementById('conversationContainer');
    const conversationHistory = document.getElementById('conversationHistory');
    const conversationTitle = document.getElementById('conversationTitle');
    const newConversationBtn = document.getElementById('newConversationBtn');
    
    if (!queryForm) return;
    
    // Current conversation ID
    let currentConversationId = null;
    
    // Initialize a new conversation
    initConversation();
    
    // Handle query submission
    queryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const query = queryInput.value.trim();
        if (!query) {
            showAlert('Please enter a query', 'warning');
            return;
        }
        
        submitQuery(query);
    });
    
    // Handle new conversation button
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            initConversation();
        });
    }
    
    /**
     * Initialize a new conversation
     */
    function initConversation() {
        // Generate a new conversation ID
        currentConversationId = generateConversationId();
        
        // Reset the query input
        queryInput.value = '';
        
        // Reset the conversation history
        conversationHistory.innerHTML = `
            <div class="text-center text-muted py-5">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-message-square mb-3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <p style="font-size: smaller;">ROXI can make mistakes</p>
            </div>
        `;
        
        // Update the conversation title
        conversationTitle.textContent = 'New Conversation';
    }
    
    /**
     * Load previous conversation from server
     */
    function loadConversation(conversationId) {
        if (!conversationId) return;
        
        // Show loading state
        conversationHistory.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading conversation...</p>
            </div>
        `;
        
        // Fetch conversation history
        fetch(`/conversation/${conversationId}`)
            .then(response => response.json())
            .then(messages => {
                // Clear conversation history
                conversationHistory.innerHTML = '';
                
                // Check if we have messages
                if (messages.length === 0) {
                    conversationHistory.innerHTML = `
                        <div class="text-center text-muted py-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-message-square mb-3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            <p>No messages in this conversation yet</p>
                        </div>
                    `;
                    return;
                }
                
                // Add each message to the conversation
                messages.forEach(message => {
                    if (message.role === 'user') {
                        addMessageToConversation('user', message.content);
                    } else if (message.role === 'assistant') {
                        addMessageToConversation('assistant', message.content, message.citations);
                    }
                });
                
                // Update the conversation title
                conversationTitle.textContent = 'Conversation History';
                
                // Scroll to show the latest user query at the top
                if (conversationContainer) {
                    const userMessages = document.querySelectorAll('.user-message');
                    if (userMessages.length > 0) {
                        const lastUserMessage = userMessages[userMessages.length - 1];
                        // Position the latest query at the top of the visible area
                        conversationContainer.scrollTop = lastUserMessage.offsetTop - 20;
                    }
                }
            })
            .catch(error => {
                console.error('Error loading conversation:', error);
                conversationHistory.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading conversation.</strong> Please try again.
                    </div>
                `;
            });
    }
    
    /**
     * Submit a query to the server
     */
    function submitQuery(query) {
        // Add user message to conversation
        const userMessageElement = addMessageToConversation('user', query);
        
        // Scroll to show the user's query at the top
        if (conversationContainer && userMessageElement) {
            // Position the message at the top of the visible area
            conversationContainer.scrollTop = userMessageElement.offsetTop - 20;
        }
        
        // Clear query input
        queryInput.value = '';
        
        // Add loading message
        const loadingElement = document.createElement('div');
        loadingElement.className = 'chat-message assistant-message d-flex';
        loadingElement.innerHTML = `
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-2">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    <strong>Searching documents...</strong>
                </div>
            </div>
        `;
        conversationHistory.appendChild(loadingElement);
        
        // Send query to server
        fetch('/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                conversation_id: currentConversationId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Remove loading message
            conversationHistory.removeChild(loadingElement);
            
            if (data.success) {
                // Add assistant response to conversation
                addMessageToConversation('assistant', data.response, data.citations);
                
                // Update conversation ID if needed
                if (data.conversation_id && data.conversation_id !== currentConversationId) {
                    currentConversationId = data.conversation_id;
                }
                
                // Update the conversation title
                conversationTitle.textContent = 'Conversation';
                
                // Maintain the scroll position to keep showing the user query
                if (conversationContainer && userMessageElement) {
                    // Position the user message at the top again after the answer is loaded
                    conversationContainer.scrollTop = userMessageElement.offsetTop - 20;
                }
            } else {
                // Show error message
                const errorMessage = `
                    <div class="alert alert-danger">
                        <strong>Error:</strong> ${data.error || 'Something went wrong. Please try again.'}
                    </div>
                `;
                addMessageToConversation('assistant', errorMessage);
            }
        })
        .catch(error => {
            console.error('Error submitting query:', error);
            
            // Remove loading message
            conversationHistory.removeChild(loadingElement);
            
            // Show error message
            const errorMessage = `
                <div class="alert alert-danger">
                    <strong>Error submitting query.</strong> Please try again.
                </div>
            `;
            addMessageToConversation('assistant', errorMessage);
        });
    }
    
    /**
     * Generate a random conversation ID
     */
    function generateConversationId() {
        return 'conv_' + Math.random().toString(36).substring(2, 15);
    }
}

/**
 * Add a message to the conversation
 */
function addMessageToConversation(role, message, citations = []) {
    const conversationHistory = document.getElementById('conversationHistory');
    if (!conversationHistory) return null;
    
    // Clear any placeholder content
    if (conversationHistory.innerHTML.includes('ROXI can make mistakes')) {
        conversationHistory.innerHTML = '';
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${role}-message`;
    
    if (role === 'user') {
        // Simple user message
        messageElement.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-user me-2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="9" r="4"></circle></svg>
                <strong>You</strong>
            </div>
            <div>${escapeHtml(message)}</div>
        `;
    } else {
        // Assistant message with possible citations
        let formattedMessage = message;
        
        // Format citations if available
        if (citations && citations.length > 0) {
            // List citations at the end
            const citationList = citations.map((citation, index) => {
                return `
                    <div class="citation-details mt-2">
                        <div class="citation-text">${citation.citation || 'Citation not available'}</div>
                        <div class="citation-snippet mt-1">
                            <small class="text-muted">"${citation.snippet || '...'}"</small>
                        </div>
                    </div>
                `;
            }).join('');
            
            formattedMessage += `
                <div class="mt-3">
                    <strong>Sources:</strong>
                    ${citationList}
                </div>
            `;
        }
        
        messageElement.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-book me-2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                <strong>Research Assistant</strong>
            </div>
            <div>${formattedMessage}</div>
        `;
    }
    
    // Add to conversation history
    conversationHistory.appendChild(messageElement);
    
    // Return the message element for reference
    return messageElement;
}
