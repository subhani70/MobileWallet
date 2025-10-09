import * as secureStorage from './secureStorage';
import { ES256KSigner } from 'did-jwt';
import { createVerifiableCredentialJwt, createVerifiablePresentationJwt } from 'did-jwt-vc';
import logger from '../utils/logger';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

/**
 * Issue a credential locally (signed by mobile)
 * Using ES256K (without -R) since it works with the stored public key
 */
export const issueCredentialLocally = async (credentialData) => {
  try {
    const did = await secureStorage.getDID();
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!did || !privateKey) {
      throw new Error('No wallet found');
    }
    
    logger.info('📜 Creating credential...');
    
    // Create signer from private key
    const keyBytes = Buffer.from(privateKey.slice(2), 'hex');
    const signer = ES256KSigner(keyBytes);
    
    // Build credential payload
    const vcPayload = {
      sub: did,
      nbf: Math.floor(Date.now() / 1000),
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential"],
        credentialSubject: credentialData
      }
    };
    
    // ✅ Use ES256K (not ES256K-R) - works with stored public key
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
    
    // Store locally
    await secureStorage.addCredential(credential);
    
    logger.success('📦 Credential stored in wallet');
    
    return credential;
    
  } catch (error) {
    logger.error('Failed to create credential: ' + error.message);
    console.error('Full error:', error);
    throw error;
  }
};

/**
 * Create a verifiable presentation locally (signed by mobile)
 */
export const createPresentationLocally = async (credentials, challenge) => {
  try {
    const did = await secureStorage.getDID();
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!did || !privateKey) {
      throw new Error('No wallet found');
    }
    
    logger.info('📋 Creating presentation...');
    
    // Create signer from private key
    const keyBytes = Buffer.from(privateKey.slice(2), 'hex');
    const signer = ES256KSigner(keyBytes);
    
    // Build VP payload
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
    
    // ✅ Use ES256K (not ES256K-R) - works with stored public key
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
    console.error('Full error:', error);
    throw error;
  }
};

export default {
  issueCredentialLocally,
  createPresentationLocally,
};