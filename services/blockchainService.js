// blockchainService.js
// Blockchain service for VoltusWave (VW) native currency on custom Geth network
// Note: VW is the native currency on this blockchain (similar to ETH on Ethereum mainnet)

import { ethers } from 'ethers';
import * as secureStorage from './secureStorage';
import * as accountManager from './accountManager';
import { ERC20_ABI } from '../config/contracts';
import logger from '../utils/logger';
import { getSelectedNetwork } from './networkService';

let cachedProvider = null;
let cachedRpcUrl = null;
let cachedChainId = null;

export const resetProviderCache = () => {
  cachedProvider = null;
  cachedRpcUrl = null;
  cachedChainId = null;
};

export const getProvider = async () => {
  try {
    const network = await getSelectedNetwork();
    if (!network?.rpcUrl) {
      throw new Error('Network RPC endpoint is not configured.');
    }

    if (cachedProvider && cachedRpcUrl === network.rpcUrl && cachedChainId === network.chainId) {
      return cachedProvider;
    }

    cachedRpcUrl = network.rpcUrl;
    cachedChainId = network.chainId;
    cachedProvider = new ethers.JsonRpcProvider(network.rpcUrl, network.chainId ? Number(network.chainId) : undefined);
    return cachedProvider;
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
    return new ethers.Wallet(legacyKey, await getProvider());
  }
  return new ethers.Wallet(privateKey, await getProvider());
};

export const getVwBalance = async () => {
  try {
    const wallet = await getWallet();
    const provider = await getProvider();
    const balance = await provider.getBalance(wallet.address);
    // formatEther converts wei to VW (native currency on this Geth network)
    return ethers.formatEther(balance);
  } catch (error) {
    logger.error('Failed to get VW balance:', error);
    return '0';
  }
};

const getErc20Contract = (address, provider) => {
  if (!address) throw new Error('Token address missing.');
  return new ethers.Contract(address, ERC20_ABI, provider);
};

export const getTokenMetadata = async (address) => {
  try {
    const provider = await getProvider();
    const contract = getErc20Contract(address, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => null),
      contract.symbol().catch(() => null),
      contract.decimals().catch(() => 18),
    ]);
    return {
      address: address.toLowerCase(),
      name: name || symbol || 'Unknown Token',
      symbol: symbol || 'TKN',
      decimals: Number(decimals) || 18,
    };
  } catch (error) {
    logger.error(`Failed to fetch token metadata for ${address}:`, error);
    throw new Error(error?.message || 'Unable to fetch token metadata.');
  }
};

export const getTokenBalanceByAddress = async (address, decimals = 18) => {
  try {
    const wallet = await getWallet();
    const provider = await getProvider();
    const contract = getErc20Contract(address, provider);
    const balance = await contract.balanceOf(wallet.address);
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    logger.error(`Failed to get token balance for ${address}:`, error);
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

export const sendTokenByAddress = async (address, decimals, toAddress, amountInTokens) => {
  try {
    if (!ethers.isAddress(toAddress)) throw new Error('Invalid recipient address.');
    const wallet = await getWallet();
    const provider = await getProvider();
    const contract = getErc20Contract(address, provider).connect(wallet);
    const amount = ethers.parseUnits(amountInTokens, decimals);
    
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