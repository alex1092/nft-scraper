import { NextResponse } from "next/server";
import { getTokenURI, fetchMetadata, fetchImageData } from "@/utils/nftScraper";

// Default API key for demo purposes - not recommended for production
const FALLBACK_INFURA_KEY = "d33312562fd342ca878310420de6935d";

// Process a single token and return its data
export async function POST(request) {
  try {
    const { contractAddress, tokenId } = await request.json();

    if (!contractAddress || !tokenId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get API keys from environment variables with fallbacks
    const infuraApiKey = process.env.INFURA_API_KEY || FALLBACK_INFURA_KEY;
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    const primaryProvider = process.env.PRIMARY_PROVIDER || "infura";

    console.log(
      `Using provider: ${primaryProvider}, Contract: ${contractAddress}, TokenID: ${tokenId}`
    );

    // Process a single token
    console.log(`Processing token ID: ${tokenId}`);

    // Get token URI
    const tokenURI = await getTokenURI(
      contractAddress,
      tokenId,
      infuraApiKey,
      primaryProvider
    );

    if (!tokenURI) {
      console.error(
        `Failed to get tokenURI for contract ${contractAddress} and token ${tokenId}`
      );
      return NextResponse.json({
        tokenId,
        success: false,
        error:
          "Failed to get tokenURI. Please check the contract address and token ID.",
      });
    }

    // Fetch metadata
    const metadata = await fetchMetadata(tokenURI);
    if (!metadata || !metadata.image) {
      return NextResponse.json({
        tokenId,
        success: false,
        error: "Failed to fetch metadata or no image found",
      });
    }

    // Fetch image data
    const imageUrl = metadata.image;
    const imageData = await fetchImageData(imageUrl);

    if (!imageData) {
      return NextResponse.json({
        tokenId,
        success: false,
        error: "Failed to download image",
      });
    }

    console.log(`Successfully processed token ID ${tokenId}`);

    // Return the image data as base64 to avoid binary transmission issues
    const base64Image = Buffer.from(imageData.data).toString("base64");

    return NextResponse.json({
      tokenId,
      success: true,
      metadata,
      imageData: {
        base64: base64Image,
        contentType: imageData.contentType,
      },
    });
  } catch (error) {
    console.error("Error processing token:", error);
    return NextResponse.json(
      { error: error.message || "An unknown error occurred" },
      { status: 500 }
    );
  }
}
