                // Add each message to the conversation
                messages.forEach(message => {
                    if (message.role === 'user') {
                        addMessageToConversation('user', message.content);
                    } else if (message.role === 'assistant') {
                        addMessageToConversation('assistant', message.content, message.citations);
                    }
                });
                
                // Update the conversation title
                // If there are messages, this isnt a first query situation
                if (messages.length > 0) {
                    isFirstQuery = false;
                    console.log("Loaded conversation has messages, isFirstQuery set to false");
                }
                conversationTitle.textContent = 'Conversation History';
                
                // Only scroll to bottom for existing conversations with messages
                if (messages.length > 0) {
                    conversationContainer.scrollTop = conversationContainer.scrollHeight;
                }
