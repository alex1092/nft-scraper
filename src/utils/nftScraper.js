import { Web3 } from "web3";
import axios from "axios";

// ERC-721 ABI (simplified for tokenURI function)
const ERC721_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  // Alternative function name used by some contracts
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "uri",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  // For contracts that implement ERC721Metadata
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

// Cache for tokenURI results to reduce RPC calls
const tokenURICache = new Map();

// Cache key generator
const getCacheKey = (contractAddress, tokenId) =>
  `${contractAddress.toLowerCase()}-${tokenId}`;

// RPC providers configuration
const RPC_PROVIDERS = {
  infura: (apiKey) => `https://mainnet.infura.io/v3/${apiKey}`,
  alchemy: (apiKey) => `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
  ankr: () => "https://rpc.ankr.com/eth",
  cloudflare: () => "https://cloudflare-eth.com",
  public: () => "https://ethereum.publicnode.com",
};

// IPFS gateway URLs to try in order
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.fleek.co/ipfs/",
  "https://gateway.ipfs.io/ipfs/",
  "https://cf-ipfs.com/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

// Function to get a Web3 instance with fallback providers
const getWeb3Instance = async (primaryProvider, apiKey) => {
  try {
    // Try the primary provider first
    const provider =
      RPC_PROVIDERS[primaryProvider]?.(apiKey) || RPC_PROVIDERS.infura(apiKey);
    console.log(`Connecting to provider: ${primaryProvider}`);

    if (
      !apiKey &&
      (primaryProvider === "infura" || primaryProvider === "alchemy")
    ) {
      console.warn(`Warning: No API key provided for ${primaryProvider}`);
    }

    // Create Web3 instance with increased timeout
    const web3 = new Web3(provider, {
      timeout: 30000, // 30 seconds
      reconnect: {
        auto: true,
        delay: 1000,
        maxAttempts: 3,
      },
    });

    // Test the connection
    console.log("Testing connection by getting block number...");
    const blockNumber = await web3.eth.getBlockNumber();
    console.log(`Connection successful. Current block number: ${blockNumber}`);
    return web3;
  } catch (error) {
    console.error(`Error connecting to ${primaryProvider}: ${error.message}`);

    // Try fallback providers
    for (const [providerName, providerFn] of Object.entries(RPC_PROVIDERS)) {
      if (providerName === primaryProvider) continue;

      try {
        console.log(`Trying fallback provider: ${providerName}`);
        const fallbackProvider = providerFn(apiKey);
        const web3 = new Web3(fallbackProvider, {
          timeout: 30000, // 30 seconds
          reconnect: {
            auto: true,
            delay: 1000,
            maxAttempts: 3,
          },
        });
        const blockNumber = await web3.eth.getBlockNumber();
        console.log(
          `Fallback connection successful. Current block number: ${blockNumber}`
        );
        return web3;
      } catch (fallbackError) {
        console.error(
          `Error connecting to fallback ${providerName}: ${fallbackError.message}`
        );
      }
    }

    throw new Error(
      "All RPC providers failed. Please check your API keys and network connection."
    );
  }
};

// Function to get metadata URI for an NFT
export async function getTokenURI(
  contractAddress,
  tokenId,
  infuraApiKey,
  primaryProvider = "infura"
) {
  // Check cache first
  const cacheKey = getCacheKey(contractAddress, tokenId);
  if (tokenURICache.has(cacheKey)) {
    console.log(
      `Using cached tokenURI for ${contractAddress} token ${tokenId}`
    );
    return tokenURICache.get(cacheKey);
  }

  try {
    console.log(`Getting web3 instance for provider: ${primaryProvider}`);
    const web3 = await getWeb3Instance(primaryProvider, infuraApiKey);

    console.log(`Creating contract instance for ${contractAddress}`);
    const nftContract = new web3.eth.Contract(ERC721_ABI, contractAddress);

    // Try to get contract name and symbol for debugging
    try {
      const name = await nftContract.methods.name().call();
      const symbol = await nftContract.methods.symbol().call();
      console.log(`Contract name: ${name}, symbol: ${symbol}`);
    } catch (nameError) {
      console.log(`Could not get contract name/symbol: ${nameError.message}`);
    }

    // Try tokenURI method first
    try {
      console.log(`Calling tokenURI for token ${tokenId}`);
      const tokenURI = await nftContract.methods.tokenURI(tokenId).call();
      console.log(`Successfully got tokenURI: ${tokenURI}`);

      // Cache the result
      tokenURICache.set(cacheKey, tokenURI);

      return tokenURI;
    } catch (tokenURIError) {
      console.log(`tokenURI method failed: ${tokenURIError.message}`);

      // Try uri method as fallback (used by some ERC1155 contracts)
      try {
        console.log(`Trying uri method for token ${tokenId}`);
        const uri = await nftContract.methods.uri(tokenId).call();
        console.log(`Successfully got uri: ${uri}`);

        // Some contracts return a URI with {id} placeholder
        const formattedUri = uri.replace(
          "{id}",
          tokenId.toString().padStart(64, "0")
        );

        // Cache the result
        tokenURICache.set(cacheKey, formattedUri);

        return formattedUri;
      } catch (uriError) {
        console.log(`uri method failed: ${uriError.message}`);
        throw new Error(
          `Both tokenURI and uri methods failed for token ${tokenId}`
        );
      }
    }
  } catch (error) {
    console.error(
      `Error getting tokenURI for token ${tokenId}: ${error.message}`
    );
    console.error(`Contract: ${contractAddress}, Provider: ${primaryProvider}`);
    console.error(`Stack trace: ${error.stack}`);
    return null;
  }
}

// Function to fetch metadata from URI
export async function fetchMetadata(tokenURI) {
  try {
    console.log(`Fetching metadata from: ${tokenURI}`);

    // Handle IPFS URIs
    if (tokenURI.startsWith("ipfs://")) {
      const ipfsHash = tokenURI.replace("ipfs://", "");

      // Try multiple IPFS gateways
      let lastError = null;
      for (const gateway of IPFS_GATEWAYS) {
        try {
          const gatewayUrl = gateway + ipfsHash;
          console.log(`Trying IPFS gateway: ${gatewayUrl}`);

          const response = await axios.get(gatewayUrl, {
            timeout: 10000, // 10 second timeout
            headers: {
              Accept: "application/json",
              "User-Agent": "NFT-Scraper/1.0",
            },
          });

          console.log(`Successfully fetched metadata from ${gatewayUrl}`);
          return response.data;
        } catch (gatewayError) {
          console.log(`Gateway ${gateway} failed: ${gatewayError.message}`);
          lastError = gatewayError;
        }
      }

      // If we get here, all gateways failed
      throw lastError || new Error("All IPFS gateways failed");
    }

    // Regular HTTP URL
    const response = await axios.get(tokenURI, {
      timeout: 10000, // 10 second timeout
      headers: {
        Accept: "application/json",
        "User-Agent": "NFT-Scraper/1.0",
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching metadata: ${error.message}`);
    return null;
  }
}

// Function to fetch image data
export async function fetchImageData(imageUrl) {
  try {
    console.log(`Downloading image from: ${imageUrl}`);

    // Handle IPFS URLs
    if (imageUrl.startsWith("ipfs://")) {
      const ipfsHash = imageUrl.replace("ipfs://", "");

      // Try multiple IPFS gateways
      let lastError = null;
      for (const gateway of IPFS_GATEWAYS) {
        try {
          const gatewayUrl = gateway + ipfsHash;
          console.log(`Trying IPFS gateway for image: ${gatewayUrl}`);

          const response = await axios({
            method: "GET",
            url: gatewayUrl,
            responseType: "arraybuffer",
            timeout: 15000, // 15 second timeout
            headers: {
              "User-Agent": "NFT-Scraper/1.0",
            },
          });

          console.log(`Successfully downloaded image from ${gatewayUrl}`);
          return {
            data: response.data,
            contentType: response.headers["content-type"] || "image/jpeg",
          };
        } catch (gatewayError) {
          console.log(
            `Gateway ${gateway} failed for image: ${gatewayError.message}`
          );
          lastError = gatewayError;
        }
      }

      // If we get here, all gateways failed
      throw lastError || new Error("All IPFS gateways failed for image");
    }

    // Regular HTTP URL
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "arraybuffer",
      timeout: 15000, // 15 second timeout
      headers: {
        "User-Agent": "NFT-Scraper/1.0",
      },
    });

    return {
      data: response.data,
      contentType: response.headers["content-type"] || "image/jpeg",
    };
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    return null;
  }
}

// Process a single NFT token
async function processToken(
  contractAddress,
  tokenId,
  infuraApiKey,
  primaryProvider = "infura"
) {
  console.log(`Processing token ID: ${tokenId}`);

  // Get token URI
  const tokenURI = await getTokenURI(
    contractAddress,
    tokenId,
    infuraApiKey,
    primaryProvider
  );
  if (!tokenURI) {
    return { tokenId, success: false, error: "Failed to get tokenURI" };
  }

  // Fetch metadata
  const metadata = await fetchMetadata(tokenURI);
  if (!metadata || !metadata.image) {
    return {
      tokenId,
      success: false,
      error: "Failed to fetch metadata or no image found",
    };
  }

  // Fetch image data
  const imageUrl = metadata.image;
  const imageData = await fetchImageData(imageUrl);

  if (!imageData) {
    return { tokenId, success: false, error: "Failed to download image" };
  }

  console.log(`Successfully downloaded image for token ID ${tokenId}`);

  return {
    tokenId,
    success: true,
    metadata,
    imageData,
  };
}

// Main function to scrape NFTs with parallel processing
export async function scrapeNFTs(
  contractAddress,
  startTokenId,
  endTokenId,
  infuraApiKey,
  primaryProvider = "infura"
) {
  console.log(`Starting to scrape NFTs from contract: ${contractAddress}`);

  // Create an array of token IDs to process
  const tokenIds = [];
  for (let i = Number(startTokenId); i <= Number(endTokenId); i++) {
    tokenIds.push(i);
  }

  // Process tokens in parallel
  const batchSize = 5; // Increased batch size for faster processing
  const results = [];

  for (let i = 0; i < tokenIds.length; i += batchSize) {
    const batch = tokenIds.slice(i, i + batchSize);

    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map((tokenId) =>
        processToken(contractAddress, tokenId, infuraApiKey, primaryProvider)
      )
    );

    results.push(...batchResults);
  }

  return {
    contractAddress,
    startTokenId: Number(startTokenId),
    endTokenId: Number(endTokenId),
    results,
  };
}
