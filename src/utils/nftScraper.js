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

// Function to get metadata URI for an NFT
export async function getTokenURI(contractAddress, tokenId, infuraApiKey) {
  try {
    const web3 = new Web3(`https://mainnet.infura.io/v3/${infuraApiKey}`);
    const nftContract = new web3.eth.Contract(ERC721_ABI, contractAddress);
    const tokenURI = await nftContract.methods.tokenURI(tokenId).call();
    return tokenURI;
  } catch (error) {
    console.error(`Error getting tokenURI: ${error.message}`);
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

    const response = await axios.get(uri);
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

// Main function to scrape NFTs
export async function scrapeNFTs(
  contractAddress,
  startTokenId,
  endTokenId,
  infuraApiKey
) {
  console.log(`Starting to scrape NFTs from contract: ${contractAddress}`);

  const results = [];

  for (
    let tokenId = Number(startTokenId);
    tokenId <= Number(endTokenId);
    tokenId++
  ) {
    console.log(`Processing token ID: ${tokenId}`);

    // Get token URI
    const tokenURI = await getTokenURI(contractAddress, tokenId, infuraApiKey);
    if (!tokenURI) {
      results.push({
        tokenId,
        success: false,
        error: "Failed to get tokenURI",
      });
      continue;
    }

    // Fetch metadata
    const metadata = await fetchMetadata(tokenURI);
    if (!metadata || !metadata.image) {
      results.push({
        tokenId,
        success: false,
        error: "Failed to fetch metadata or no image found",
      });
      continue;
    }

    // Fetch image data
    const imageUrl = metadata.image;
    const imageData = await fetchImageData(imageUrl);

    if (!imageData) {
      results.push({
        tokenId,
        success: false,
        error: "Failed to download image",
      });
      continue;
    }

    results.push({
      tokenId,
      success: true,
      metadata,
      imageData,
    });

    console.log(`Successfully downloaded image for token ID ${tokenId}`);
  }

  return {
    contractAddress,
    startTokenId: Number(startTokenId),
    endTokenId: Number(endTokenId),
    results,
  };
}
