import { NextResponse } from "next/server";
import { scrapeNFTs } from "@/utils/nftScraper";
import JSZip from "jszip";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const contractAddress = searchParams.get("contractAddress");
  const startTokenId = searchParams.get("startTokenId");
  const endTokenId = searchParams.get("endTokenId");

  return handleScrapeRequest(contractAddress, startTokenId, endTokenId);
}

export async function POST(request) {
  try {
    const { contractAddress, startTokenId, endTokenId } = await request.json();
    return handleScrapeRequest(contractAddress, startTokenId, endTokenId);
  } catch (error) {
    console.error("Error parsing request body:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

async function handleScrapeRequest(contractAddress, startTokenId, endTokenId) {
  try {
    if (!contractAddress || !startTokenId || !endTokenId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Limit the number of tokens to scrape to prevent abuse
    const maxTokens = 100;
    const actualEndTokenId = Math.min(
      Number(startTokenId) + maxTokens,
      Number(endTokenId)
    );

    // Get the INFURA_API_KEY from environment variables
    const infuraApiKey = process.env.INFURA_API_KEY;

    if (!infuraApiKey) {
      return NextResponse.json(
        { error: "Missing INFURA_API_KEY in environment variables" },
        { status: 500 }
      );
    }

    // Scrape NFTs
    const scrapedData = await scrapeNFTs(
      contractAddress,
      startTokenId,
      actualEndTokenId,
      infuraApiKey
    );

    // Create a zip file with the images
    const zip = new JSZip();
    const imagesFolder = zip.folder("images");

    // Add metadata.json file with all the metadata
    zip.file("metadata.json", JSON.stringify(scrapedData, null, 2));

    // Add each image to the zip file
    for (const result of scrapedData.results) {
      if (result.success && result.imageData) {
        const fileName = `${result.tokenId}.jpg`;
        imagesFolder.file(fileName, result.imageData.data, { binary: true });
      }
    }

    // Generate the zip file
    const zipContent = await zip.generateAsync({ type: "arraybuffer" });

    // Return the zip file
    return new NextResponse(zipContent, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="nft-collection-${contractAddress}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error in scrape endpoint:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
