function checkDocumentTextQuality(documentId) {
        // Get text quality UI elements for document panel
        const documentTextQualitySection = document.getElementById("documentTextQualitySection");
        const documentTextQualityBadge = document.getElementById("documentTextQualityBadge");
        
        // Reset document text quality UI elements
        if (documentTextQualitySection) {
            documentTextQualitySection.classList.add("d-none");
        }
        
        // Get text extraction quality
        fetch(`/api/documents/${documentId}/text-quality`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update the text quality badges
                    const quality = data.text_extraction_quality || "unknown";
                    const qualityCapitalized = quality.charAt(0).toUpperCase() + quality.slice(1);
                    
                    // Update the text quality badge in document panel
                    if (documentTextQualityBadge) {
                        documentTextQualityBadge.textContent = qualityCapitalized;
                        
                        // Set the badge color based on quality
                        documentTextQualityBadge.parentElement.className = "badge"; // Reset
                        if (quality === "good") {
                            documentTextQualityBadge.parentElement.classList.add("bg-success");
                        } else if (quality === "limited") {
                            documentTextQualityBadge.parentElement.classList.add("bg-warning");
                            if (documentTextQualitySection) documentTextQualitySection.classList.remove("d-none");
                        } else if (quality === "none") {
                            documentTextQualityBadge.parentElement.classList.add("bg-danger");
                            if (documentTextQualitySection) documentTextQualitySection.classList.remove("d-none");
                        } else {
                            documentTextQualityBadge.parentElement.classList.add("bg-secondary");
                        }
                    }
                } else {
                    console.error("Error checking document text quality:", data.error);
                }
            })
            .catch(error => {
                console.error("Error fetching document text quality:", error);
            });
}
document.addEventListener('DOMContentLoaded', initDocumentBrowser);
