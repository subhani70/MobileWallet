// // config/config.js

// const API_CONFIG = {
//   // BASE_URL: 'http://192.168.1.4:5000',  // Updated with port
//   BASE_URL: 'http://172.16.10.117:5000',  // Updated with port
//   TIMEOUT: 10000,
//   // BLOCKCHAIN_URL: 'http://192.168.1.4:8545', // localhost won’t work on mobile, so updated
//   BLOCKCHAIN_URL: 'http://172.16.10.117:8545', // localhost won’t work on mobile, so updated
//   REGISTRY_ADDRESS: '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab',
// };

// export default API_CONFIG;


const API_CONFIG = {
  BASE_URL: 'http://192.168.1.6:5000',  //home
  // BASE_URL: 'http://172.16.10.117:5000',  // office
  

  TIMEOUT: 10000,
  BLOCKCHAIN_URL: 'http://192.168.1.6:8545',  // home
  // BLOCKCHAIN_URL: 'http://172.16.10.117:8545', // office

  REGISTRY_ADDRESS: '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab',
};

export default API_CONFIG;