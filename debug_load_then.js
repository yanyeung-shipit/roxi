            .then(response => {
                console.log('loadDocuments response status:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('loadDocuments response data:', data);
                if (data.success) {
                    documents = data.documents || [];
                    totalPages = data.total_pages || 1;
                    
                    console.log(`Loaded ${documents.length} documents (page ${currentPage} of ${totalPages})`);
