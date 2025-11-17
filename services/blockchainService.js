// blockchainService.js
// Blockchain service for VoltusWave (VW) native currency on custom Geth network
// Note: VW is the native currency on this blockchain (similar to ETH on Ethereum mainnet)

import { ethers } from 'ethers';
import * as secureStorage from './secureStorage';
import * as accountManager from './accountManager';
import API_CONFIG from '../config/config';
import { TOKENS } from '../config/contracts';
import logger from '../utils/logger';

export const getProvider = () => {
  try {
    return new ethers.JsonRpcProvider(API_CONFIG.BLOCKCHAIN_URL);
  } catch (error) {
    logger.error('Failed to get blockchain provider:', error);
    throw new Error('Could not connect to the blockchain network.');
  }
};

export const getWallet = async () => {
  // Use active account's private key from multi-account system
  const privateKey = await accountManager.getActiveAccountPrivateKey();
  if (!privateKey) {
    // Fallback to legacy storage for backward compatibility
    const legacyKey = await secureStorage.getPrivateKey();
    if (!legacyKey) throw new Error('Wallet not initialized.');
    return new ethers.Wallet(legacyKey, getProvider());
  }
  return new ethers.Wallet(privateKey, getProvider());
};

export const getVwBalance = async () => {
  try {
    const wallet = await getWallet();
    const balance = await getProvider().getBalance(wallet.address);
    // formatEther converts wei to VW (native currency on this Geth network)
    return ethers.formatEther(balance);
  } catch (error) {
    logger.error('Failed to get VW balance:', error);
    return '0';
  }
};

const getErc20Contract = (tokenSymbol) => {
  const token = TOKENS[tokenSymbol];
  if (!token) throw new Error(`Token ${tokenSymbol} not configured.`);
  return new ethers.Contract(token.address, token.abi, getProvider());
};

export const getTokenBalance = async (tokenSymbol) => {
  try {
    const wallet = await getWallet();
    const contract = getErc20Contract(tokenSymbol);
    const balance = await contract.balanceOf(wallet.address);
    return ethers.formatUnits(balance, TOKENS[tokenSymbol].decimals);
  } catch (error) {
    logger.error(`Failed to get ${tokenSymbol} balance:`, error);
    return '0';
  }
};

export const sendVw = async (toAddress, amountInVw) => {
  try {
    if (!ethers.isAddress(toAddress)) throw new Error('Invalid recipient address.');
    const wallet = await getWallet();
    // parseEther converts VW amount to wei (native currency units on this Geth network)
    const tx = { to: toAddress, value: ethers.parseEther(amountInVw) };
    const txResponse = await wallet.sendTransaction(tx);
    const receipt = await txResponse.wait();
    return { success: true, receipt };
  } catch (error) {
    let friendlyError = error.message;
    if (error.code === 'INSUFFICIENT_FUNDS') {
      friendlyError = 'Insufficient VW for this transaction, including gas fees.';
    }
    return { success: false, error: friendlyError };
  }
};

export const sendToken = async (tokenSymbol, toAddress, amountInTokens) => {
  try {
    if (!ethers.isAddress(toAddress)) throw new Error('Invalid recipient address.');
    const wallet = await getWallet();
    const token = TOKENS[tokenSymbol];
    if (!token) throw new Error(`Token ${tokenSymbol} not configured.`);
    
    const contract = getErc20Contract(tokenSymbol).connect(wallet);
    const amount = ethers.parseUnits(amountInTokens, token.decimals);
    
    const txResponse = await contract.transfer(toAddress, amount);
    const receipt = await txResponse.wait();
    return { success: true, receipt };
  } catch (error) {
    let friendlyError = error.message;
    if (error.code === 'INSUFFICIENT_FUNDS') {
      friendlyError = 'Insufficient VW for gas fees.';
    }
    return { success: false, error: friendlyError };
  }
};