// services/api.js
// API Service Layer for Self-Sovereign Identity Wallet
// Updated to match your backend endpoints

import axios from 'axios';
import API_CONFIG from '../config/config';
import logger from '../utils/logger';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - logs all outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    logger.info(`📤 API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    logger.error(`Request Error: ${error.message}`);
    return Promise.reject(error);
  }
);

// Response interceptor - logs all responses and errors
apiClient.interceptors.response.use(
  (response) => {
    logger.success(`📥 Response: ${response.config.url} - Status ${response.status}`);
    return response;
  },
  (error) => {
    if (error.response) {
      logger.error(`❌ API Error: ${error.response.status} - ${error.response.data?.error || error.message}`);
    } else if (error.request) {
      logger.error('❌ Network Error: No response from server');
    } else {
      logger.error(`❌ Error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

// ============================================
// HEALTH CHECK API
// ============================================
export const healthAPI = {
  // Check backend health
  check: async () => {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// ============================================
// DID API - Matches your backend
// ============================================
export const didAPI = {
  // Create a new DID (backend generates keys and registers on blockchain)
  createBackend: async () => {
    try {
      const response = await apiClient.post('/create-did');
      logger.success(`🆔 DID Created: ${response.data.did.did}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create DID on backend');
      throw error;
    }
  },

  // Resolve a DID to get its DID Document
  resolve: async (did) => {
    try {
      const response = await apiClient.get(`/resolve-did/${did}`);
      logger.success(`🔍 DID Resolved: ${did}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to resolve DID: ${did}`);
      throw error;
    }
  },
};

// ============================================
// VERIFIABLE CREDENTIALS API
// ============================================
export const vcAPI = {
  // Issue a new verifiable credential
  issue: async (issuerDID, subjectDID, credentialData) => {
    try {
      const response = await apiClient.post('/store-vc', {
        issuerDID,
        subjectDID,
        credentialData,
      });
      logger.success(`📜 Credential Issued to ${subjectDID}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to issue credential');
      throw error;
    }
  },

  // List all credentials
  list: async () => {
    try {
      const response = await apiClient.get('/list-vc');
      logger.info(`📋 Retrieved ${response.data.length} credentials`);
      return response.data;
    } catch (error) {
      logger.error('Failed to list credentials');
      throw error;
    }
  },

  // Verify a verifiable credential
  verify: async (jwt) => {
    try {
      const response = await apiClient.post('/verify-vc', { jwt });
      const status = response.data.verified ? '✅' : '❌';
      logger.info(`${status} Credential verification: ${response.data.verified}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to verify credential');
      throw error;
    }
  },
};

// ============================================
// VERIFIABLE PRESENTATIONS API
// ============================================
export const vpAPI = {
  // Create a verifiable presentation
  // create: async (holderDID, credentialIds, challenge) => {
  //   try {
  //     const response = await apiClient.post('/create-vp', {
  //       holderDID,
  //       credentialIds,
  //       challenge,
  //     });
  //     logger.success(`📋 Presentation Created by ${holderDID}`);
  //     return response.data;
  //   } catch (error) {
  //     logger.error('Failed to create presentation');
  //     throw error;
  //   }
  // },

  // Create a verifiable presentation
  create: async (holderDID, credentials, challenge) => {
    try {
      const response = await apiClient.post('/create-vp', {
        holderDID,
        credentials, // Now sending full credential objects
        challenge,
      });
      logger.success(`📋 Presentation Created by ${holderDID}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create presentation');
      throw error;
    }
  },

  // Verify a verifiable presentation
  verify: async (vpJwt, challenge) => {
    try {
      const response = await apiClient.post('/verify-vp', {
        vpJwt,
        challenge,
      });
      const status = response.data.verified ? '✅' : '❌';
      logger.info(`${status} Presentation verification: ${response.data.verified}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to verify presentation');
      throw error;
    }
  },
};

export default apiClient;