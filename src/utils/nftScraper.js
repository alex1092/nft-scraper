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
};

// Function to get a Web3 instance with fallback providers
const getWeb3Instance = async (primaryProvider, apiKey) => {
  try {
    // Try the primary provider first
    const provider =
      RPC_PROVIDERS[primaryProvider]?.(apiKey) || RPC_PROVIDERS.infura(apiKey);
    const web3 = new Web3(provider);

    // Test the connection
    await web3.eth.getBlockNumber();
    return web3;
  } catch (error) {
    console.error(`Error connecting to ${primaryProvider}: ${error.message}`);

    // Try fallback providers
    for (const [providerName, providerFn] of Object.entries(RPC_PROVIDERS)) {
      if (providerName === primaryProvider) continue;

      try {
        console.log(`Trying fallback provider: ${providerName}`);
        const fallbackProvider = providerFn(apiKey);
        const web3 = new Web3(fallbackProvider);
        await web3.eth.getBlockNumber();
        return web3;
      } catch (fallbackError) {
        console.error(
          `Error connecting to fallback ${providerName}: ${fallbackError.message}`
        );
      }
    }

    throw new Error("All RPC providers failed");
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
    return tokenURICache.get(cacheKey);
  }

  try {
    const web3 = await getWeb3Instance(primaryProvider, infuraApiKey);
    const nftContract = new web3.eth.Contract(ERC721_ABI, contractAddress);
    const tokenURI = await nftContract.methods.tokenURI(tokenId).call();

    // Cache the result
    tokenURICache.set(cacheKey, tokenURI);

    return tokenURI;
  } catch (error) {
    console.error(
      `Error getting tokenURI for token ${tokenId}: ${error.message}`
    );
    return null;
  }
}

// Function to fetch metadata from URI
export async function fetchMetadata(tokenURI) {
  try {
    console.log(`Fetching metadata from: ${tokenURI}`);

    // Handle IPFS URIs
    let uri = tokenURI;
    if (uri.startsWith("ipfs://")) {
      // Try a different IPFS gateway
      uri = uri.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
      console.log(`Using IPFS gateway: ${uri}`);
    }

    const response = await axios.get(uri, {
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
    let url = imageUrl;
    if (url.startsWith("ipfs://")) {
      // Try a different IPFS gateway
      url = url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
      console.log(`Using IPFS gateway: ${url}`);
    }

    const response = await axios({
      method: "GET",
      url,
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
