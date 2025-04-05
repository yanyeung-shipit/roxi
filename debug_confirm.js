// Updated confirmDeleteButton handler with debugging
if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', function() {
        console.log('Confirm delete clicked:', { deleteType, deleteId });
        
        if (deleteType === 'document' && deleteId) {
            console.log('Calling deleteDocument with ID:', deleteId);
            deleteDocument(deleteId);
        } else if (deleteType === 'collection' && deleteId) {
            deleteCollection(deleteId);
        } else if (deleteType === 'batch') {
            batchDeleteDocuments();
        } else {
            console.error('Invalid delete operation:', { deleteType, deleteId });
        }
        
        // Close modal
        if (deleteConfirmModal) {
            deleteConfirmModal.hide();
        }
    });
}
