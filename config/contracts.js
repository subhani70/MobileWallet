// A minimal ABI for standard ERC-20 functions
export const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
  ];
  
  // Add your tokens here. Key is the symbol.
  export const TOKENS = {
    "VOLT": { // Replace with your token's symbol
      address: "0x73722753Da73CaaaC79f827A599951d53EA34BcD", // PASTE YOUR DEPLOYED ADDRESS HERE
      symbol: "VOLT",
      decimals: 18, // Usually 18
      abi: ERC20_ABI,
    },
  };