


const API_CONFIG = {
  // BASE_URL: 'https://icbhyhmetd.execute-api.ap-south-1.amazonaws.com/',  // office
  BASE_URL: 'http://172.16.10.117:5000',  // office
  // BASE_URL: 'https://icbhyhmetd.execute-api.ap-south-1.amazonaws.com/',  // office
  // BASE_URL: '',  // office


  TIMEOUT: 90000, // 90 seconds for blockchain transactions
  // BLOCKCHAIN_URL: 'http://192.168.1.6:8545',  // home
  BLOCKCHAIN_URL: 'https://vymu2rbrb4.execute-api.ap-south-1.amazonaws.com/', // office
  // BLOCKCHAIN_URL: 'http://172.16.10.117:8545', // office
  // REGISTRY_ADDRESS: '0xB82F6787fDD6745A441E6649C6A08087F85BA191',
  REGISTRY_ADDRESS: '0xc19850D9d1ff19eE32914e48A9C881101bD26b9c',
};

export default API_CONFIG;