    function loadDocuments() {
        if (!documentList) return;
        
        console.log('Loading documents with filters:', {
            page: currentPage,
            search: searchTerm,
            tag: activeTag,
            collection_id: activeCollection
        });
        
        // Show loading indicator
        documentList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading documents...</p>
            </div>
        `;
        
        // Build query parameters
        let params = new URLSearchParams();
        params.append('page', currentPage);
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        if (activeTag) {
            params.append('tag', activeTag);
        }
        
        const url = `/documents/api/documents?${params.toString()}`;
        console.log('Fetching documents from:', url);
