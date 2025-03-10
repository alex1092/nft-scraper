import { NextResponse } from "next/server";
import { getTokenURI, fetchMetadata, fetchImageData } from "@/utils/nftScraper";

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

    // Get API keys from environment variables
    const infuraApiKey = process.env.INFURA_API_KEY;
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    const primaryProvider = process.env.PRIMARY_PROVIDER || "infura";

    if (!infuraApiKey && primaryProvider === "infura") {
      return NextResponse.json(
        { error: "Missing INFURA_API_KEY in environment variables" },
        { status: 500 }
      );
    }

    if (!alchemyApiKey && primaryProvider === "alchemy") {
      return NextResponse.json(
        { error: "Missing ALCHEMY_API_KEY in environment variables" },
        { status: 500 }
      );
    }

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
      return NextResponse.json({
        tokenId,
        success: false,
        error: "Failed to get tokenURI",
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
