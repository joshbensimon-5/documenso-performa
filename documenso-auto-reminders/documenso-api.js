const axios = require('axios');
const config = require('./config');

class DocumensoAPI {
  constructor() {
    this.baseUrl = config.documenso.baseUrl;
    this.apiToken = config.documenso.apiToken;
    this.apiVersion = config.documenso.apiVersion;
    
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/${this.apiVersion}`,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Get all documents (pending and completed)
  async getDocuments(page = 1, perPage = 50) {
    try {
      const response = await this.client.get('/documents', {
        params: { page, perPage }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch documents: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get specific document details
  async getDocument(documentId) {
    try {
      const response = await this.client.get(`/documents/${documentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch document ${documentId}: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get pending documents (documents waiting for signatures)
  async getPendingDocuments() {
    try {
      const allDocuments = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.getDocuments(page, 50);
        const documents = response.documents || response.data || response;
        
        if (Array.isArray(documents)) {
          allDocuments.push(...documents);
          hasMore = documents.length === 50; // If we got a full page, there might be more
          page++;
        } else {
          hasMore = false;
        }
      }

      // Filter for pending documents (documents with pending recipients)
      return allDocuments.filter(doc => {
        return doc.status === 'PENDING' || 
               (doc.recipients && doc.recipients.some(r => r.status === 'PENDING'));
      });
    } catch (error) {
      throw new Error(`Failed to fetch pending documents: ${error.message}`);
    }
  }

  // Send reminder for specific document and recipients
  async sendReminder(documentId, recipientIds) {
    try {
      const response = await this.client.post(`/documents/${documentId}/resend`, {
        recipients: recipientIds
      });
      
      return {
        success: true,
        data: response.data,
        documentId,
        recipientIds
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error(`❌ Failed to send reminder for document ${documentId}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        documentId,
        recipientIds
      };
    }
  }

  // Get pending recipients for a document
  getPendingRecipients(document) {
    if (!document.recipients) return [];
    
    return document.recipients
      .filter(recipient => recipient.status === 'PENDING')
      .map(recipient => recipient.id);
  }

  // Format document info for logging
  formatDocumentInfo(document) {
    const pendingRecipients = this.getPendingRecipients(document);
    return {
      id: document.id,
      title: document.title || 'Untitled Document',
      status: document.status,
      pendingRecipients: pendingRecipients.length,
      totalRecipients: document.recipients ? document.recipients.length : 0,
      createdAt: document.createdAt,
      recipients: document.recipients?.map(r => ({
        id: r.id,
        email: r.email,
        name: r.name,
        status: r.status
      })) || []
    };
  }

  // Health check - verify API connection
  async healthCheck() {
    try {
      // Try to fetch first page of documents as a health check
      await this.getDocuments(1, 1);
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        suggestion: 'Check your DOCUMENSO_API_TOKEN and DOCUMENSO_BASE_URL'
      };
    }
  }
}

module.exports = DocumensoAPI; 