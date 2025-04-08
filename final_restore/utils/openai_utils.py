"""
OpenAI API Integration for ROXI

This module provides utility functions to interact with OpenAI's GPT-4o model 
for generating answers based on retrieved document chunks.
"""
import os
import logging
import openai
from flask import current_app

logger = logging.getLogger(__name__)

def get_openai_client():
    """
    Get a configured OpenAI client
    
    Returns:
        openai.Client: Configured OpenAI client or None if API key is not available
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OpenAI API key not found in environment variables")
        return None
    
    try:
        client = openai.OpenAI(api_key=api_key)
        return client
    except Exception as e:
        logger.error(f"Error initializing OpenAI client: {str(e)}")
        return None

def generate_answer_with_gpt(query, context_chunks, model="gpt-4o"):
    """
    Generate an answer using GPT-4o based on the query and context chunks
    
    Args:
        query (str): The user's question
        context_chunks (list): List of text chunks to provide as context
        model (str): OpenAI model to use (default: gpt-4o)
        
    Returns:
        str: The generated answer or an error message if processing failed
    """
    client = get_openai_client()
    if not client:
        return "OpenAI integration is not properly configured. Please check your API key."
    
    try:
        # Format context with document identifiers
        formatted_chunks = []
        for i, chunk in enumerate(context_chunks):
            doc = chunk.document
            chunk_header = f"Source {i+1}: \"{doc.title or 'Untitled'}\" "
            if doc.authors:
                chunk_header += f"by {doc.authors}"
            formatted_chunks.append(f"{chunk_header}\n\n{chunk.text}")
        
        # Join the formatted chunks
        context_text = "\n\n" + "\n\n---\n\n".join(formatted_chunks)
        
        # Prepare the system message with improved instructions
        system_message = """You are ROXI (Rheumatology Optimized eXpert Intelligence), a specialized assistant that helps rheumatologists and researchers find information from scientific papers.

RULES:
1. Answer questions based ONLY on the context provided.
2. If the context doesn't contain enough information, say "Based on the available documents, I don't have enough information to fully answer that question." Then share what partial information you do have.
3. Use academic, professional language appropriate for medical research.
4. When referencing information, include only the number in square brackets like [1], [2], etc. (not [Document 1]).
5. Be precise with medical terminology. Don't simplify or generalize technical concepts.
6. For treatments, always specify if the information relates to diagnosis, monitoring, or treatment recommendations.
7. For medical findings, clearly indicate the strength of evidence if mentioned in the documents.
8. Do not recall information outside of the provided context, even if you know it to be factually correct.

FORMAT YOUR RESPONSE:
- Use proper Markdown formatting including:
  * Headings (## and ### for sections and subsections)
  * Bullet points or numbered lists where appropriate
  * Bold text for important information
- Start with a direct answer to the question
- Follow with detailed explanations from the documents
- Include reference numbers [1], [2], etc. after each key point
- If the question asks about multiple aspects, organize your response with clear headings"""
        
        # Create messages for the API call
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Here is information from several scientific rheumatology documents:\n{context_text}\n\nBased only on this information, please answer this question: {query}"}
        ]
        
        # Make the API call with adjusted parameters for more comprehensive answers
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1,  # Lower temperature for even more factual responses
            max_tokens=1500,  # Allow for longer responses
            top_p=0.95,       # Slightly more deterministic responses
            presence_penalty=0.1  # Slight penalty for repeating the same information
        )
        
        # Extract and return the generated answer
        if response.choices and len(response.choices) > 0:
            return response.choices[0].message.content
        else:
            return "No response was generated. Please try again."
    
    except Exception as e:
        logger.exception(f"Error generating answer with GPT: {str(e)}")
        return f"An error occurred while generating the answer: {str(e)}"