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
        # Format context for the prompt
        context_text = "\n\n---\n\n".join([chunk.text for chunk in context_chunks])
        
        # Prepare the system message with instructions
        system_message = f"""You are ROXI (Rheumatology Optimized eXpert Intelligence), an assistant that helps users 
        find information from scientific rheumatology papers. Answer questions based ONLY on the context provided.
        If the answer cannot be found in the context, say "I don't have enough information to answer that question
        based on the documents in the database." Do not make up information.
        Use academic, professional language appropriate for medical research.
        When referencing information, indicate which document it came from using [Doc X] notation."""
        
        # Create messages for the API call
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Here is information from several scientific documents:\n\n{context_text}\n\nBased on the information above, please answer this question: {query}"}
        ]
        
        # Make the API call
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,  # Lower temperature for more factual responses
            max_tokens=1000   # Limit response length
        )
        
        # Extract and return the generated answer
        if response.choices and len(response.choices) > 0:
            return response.choices[0].message.content
        else:
            return "No response was generated. Please try again."
    
    except Exception as e:
        logger.exception(f"Error generating answer with GPT: {str(e)}")
        return f"An error occurred while generating the answer: {str(e)}"