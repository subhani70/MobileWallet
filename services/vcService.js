// wallet-app/services/vcService.js
// ENHANCED: Add selective disclosure capability

import * as secureStorage from './secureStorage';
import { ES256KSigner } from 'did-jwt';
import { createVerifiableCredentialJwt, createVerifiablePresentationJwt } from 'did-jwt-vc';
import logger from '../utils/logger';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

/**
 * ✨ NEW: Create a SELECTIVE verifiable presentation
 * Only includes the fields the user chose to share
 * 
 * @param {Array} filteredCredentials - Credentials with selected fields
 * @param {String} challenge - Optional challenge
 * @param {Array} originalCredentials - Original credentials to compare against (optional)
 */
export const createSelectivePresentation = async (filteredCredentials, challenge, originalCredentials = null) => {
  try {
    const did = await secureStorage.getDID();
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!did || !privateKey) {
      throw new Error('No wallet found');
    }
    
    // Check if this is ACTUALLY selective disclosure
    let isActuallySelective = false;
    
    if (originalCredentials && originalCredentials.length > 0) {
      // Compare filtered vs original to see if any fields were excluded
      for (let i = 0; i < filteredCredentials.length; i++) {
        const filtered = filteredCredentials[i];
        const original = originalCredentials[i];
        
        if (original && original.data) {
          const filteredKeys = Object.keys(filtered.data || {});
          const originalKeys = Object.keys(original.data || {});
          
          // If any fields were removed, it's selective
          if (filteredKeys.length < originalKeys.length) {
            isActuallySelective = true;
            break;
          }
        }
      }
    }
    
    logger.info(isActuallySelective ? '🔒 Creating SELECTIVE presentation...' : '📋 Creating full presentation...');
    
    // For each credential, create a NEW JWT
    const credentialJWTs = await Promise.all(
      filteredCredentials.map(async (credential) => {
        const keyBytes = Buffer.from(privateKey.slice(2), 'hex');
        const signer = ES256KSigner(keyBytes);
        
        // Only add SelectiveDisclosure type if fields were actually filtered
        const credentialTypes = isActuallySelective 
          ? ["VerifiableCredential", "SelectiveDisclosure"]
          : ["VerifiableCredential"];
        
        const vcPayload = {
          sub: credential.subject,
          nbf: Math.floor(Date.now() / 1000),
          vc: {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            type: credentialTypes,
            credentialSubject: credential.data
          }
        };
        
        const issuer = {
          did: credential.issuer,
          signer: signer,
          alg: 'ES256K'
        };
        
        const jwt = await createVerifiableCredentialJwt(vcPayload, issuer);
        return jwt;
      })
    );
    
    // Create VP
    const keyBytes = Buffer.from(privateKey.slice(2), 'hex');
    const signer = ES256KSigner(keyBytes);
    
    // Only mark VP as selective if credentials are selective
    const vpTypes = isActuallySelective 
      ? ["VerifiablePresentation", "SelectiveDisclosure"]
      : ["VerifiablePresentation"];
    
    const vpPayload = {
      vp: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: vpTypes,
        verifiableCredential: credentialJWTs
      }
    };
    
    if (challenge) {
      vpPayload.nonce = challenge;
    }
    
    const holder = {
      did: did,
      signer: signer,
      alg: 'ES256K'
    };
    
    const vpJwt = await createVerifiablePresentationJwt(vpPayload, holder);
    
    const totalFields = filteredCredentials.reduce((sum, c) => sum + Object.keys(c.data).length, 0);
    
    if (isActuallySelective) {
      logger.success(`✅ Selective presentation created with ${totalFields} selected fields`);
    } else {
      logger.success(`✅ Full presentation created with all ${totalFields} fields`);
    }
    
    return { vpJwt };
    
  } catch (error) {
    logger.error('Failed to create presentation: ' + error.message);
    throw error;
  }
};

/**
 * Issue a credential locally (signed by mobile)
 */
export const issueCredentialLocally = async (credentialData) => {
  try {
    const did = await secureStorage.getDID();
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!did || !privateKey) {
      throw new Error('No wallet found');
    }
    
    logger.info('📜 Creating credential...');
    
    const keyBytes = Buffer.from(privateKey.slice(2), 'hex');
    const signer = ES256KSigner(keyBytes);
    
    const vcPayload = {
      sub: did,
      nbf: Math.floor(Date.now() / 1000),
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential"],
        credentialSubject: credentialData
      }
    };
    
    const issuer = {
      did: did,
      signer: signer,
      alg: 'ES256K'
    };
    
    const jwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    
    logger.success('✅ Credential created and signed locally');
    
    const credential = {
      id: Date.now().toString(),
      issuer: did,
      subject: did,
      data: credentialData,
      jwt: jwt,
      addedAt: new Date().toISOString()
    };
    
    await secureStorage.addCredential(credential);
    logger.success('📦 Credential stored in wallet');
    
    return credential;
    
  } catch (error) {
    logger.error('Failed to create credential: ' + error.message);
    throw error;
  }
};

/**
 * Create a verifiable presentation (full credential)
 */
export const createPresentationLocally = async (credentials, challenge) => {
  try {
    const did = await secureStorage.getDID();
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!did || !privateKey) {
      throw new Error('No wallet found');
    }
    
    logger.info('📋 Creating presentation...');
    
    const keyBytes = Buffer.from(privateKey.slice(2), 'hex');
    const signer = ES256KSigner(keyBytes);
    
    const vpPayload = {
      vp: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiablePresentation"],
        verifiableCredential: credentials.map(c => c.jwt)
      }
    };
    
    if (challenge) {
      vpPayload.nonce = challenge;
    }
    
    const holder = {
      did: did,
      signer: signer,
      alg: 'ES256K'
    };
    
    const vpJwt = await createVerifiablePresentationJwt(vpPayload, holder);
    
    logger.success('✅ Presentation created and signed locally');
    
    return { vpJwt };
    
  } catch (error) {
    logger.error('Failed to create presentation: ' + error.message);
    throw error;
  }
};