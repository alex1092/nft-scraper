"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import JSZip from "jszip";

export default function Home() {
  const [contractAddress, setContractAddress] = useState("");
  const [startTokenId, setStartTokenId] = useState("1");
  const [endTokenId, setEndTokenId] = useState("5");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
  });
  const [results, setResults] = useState([]);

  // Process a single token
  const processToken = async (contractAddress, tokenId) => {
    try {
      console.log(
        `Requesting token ${tokenId} from contract ${contractAddress}`
      );

      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractAddress,
          tokenId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error response for token ${tokenId}:`, errorData);
        throw new Error(
          errorData.error ||
            `Failed to process token ${tokenId} (HTTP ${response.status})`
        );
      }

      const data = await response.json();
      console.log(`Successfully processed token ${tokenId}`);
      return data;
    } catch (error) {
      console.error(`Error processing token ${tokenId}:`, error);
      return {
        tokenId,
        success: false,
        error: error.message || `Failed to process token ${tokenId}`,
      };
    }
  };

  // Create and download a zip file with the results
  const createAndDownloadZip = async (contractAddress, results) => {
    const zip = new JSZip();
    const imagesFolder = zip.folder("images");

    // Add metadata.json file with all the metadata
    const metadataResults = results.map((result) => {
      const { imageData, ...rest } = result;
      return rest;
    });

    zip.file(
      "metadata.json",
      JSON.stringify(
        {
          contractAddress,
          results: metadataResults,
        },
        null,
        2
      )
    );

    // Add each image to the zip file
    for (const result of results) {
      if (result.success && result.imageData) {
        const fileName = `${result.tokenId}.jpg`;
        const binary = atob(result.imageData.base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        imagesFolder.file(fileName, array, { binary: true });
      }
    }

    // Generate the zip file
    const zipContent = await zip.generateAsync({ type: "blob" });

    // Create a download link
    const url = window.URL.createObjectURL(zipContent);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nft-collection-${contractAddress}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setIsSuccess(false);
    setResults([]);

    try {
      // Validate inputs
      if (!contractAddress) {
        throw new Error("Contract address is required");
      }

      if (!startTokenId || !endTokenId) {
        throw new Error("Token ID range is required");
      }

      const start = Number(startTokenId);
      const end = Number(endTokenId);

      if (start > end) {
        throw new Error(
          "Start Token ID must be less than or equal to End Token ID"
        );
      }

      // Limit the number of tokens to scrape to prevent abuse
      const maxTokens = 50;
      const actualEndTokenId = Math.min(start + maxTokens, end);

      // Calculate total tokens to process
      const totalTokens = actualEndTokenId - start + 1;
      setProgress({ current: 0, total: totalTokens, percentage: 0 });

      // Process tokens sequentially to avoid overwhelming the server
      const allResults = [];

      for (let tokenId = start; tokenId <= actualEndTokenId; tokenId++) {
        const result = await processToken(contractAddress, tokenId);
        allResults.push(result);

        // Update progress
        const current = tokenId - start + 1;
        const percentage = Math.round((current / totalTokens) * 100);
        setProgress({ current, total: totalTokens, percentage });
        setResults([...allResults]); // Update results as they come in
      }

      // Create and download the zip file
      await createAndDownloadZip(contractAddress, allResults);

      // Set success state
      setIsSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 md:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          NFT Collection Scraper
        </h1>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="contractAddress"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Contract Address
              </label>
              <input
                type="text"
                id="contractAddress"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0xC0FFee8FF7e5497C2d6F7684859709225Fcc5Be8"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startTokenId"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Start Token ID
                </label>
                <input
                  type="number"
                  id="startTokenId"
                  value={startTokenId}
                  onChange={(e) => setStartTokenId(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="endTokenId"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  End Token ID
                </label>
                <input
                  type="number"
                  id="endTokenId"
                  value={endTokenId}
                  onChange={(e) => setEndTokenId(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>
                Note: For performance reasons, a maximum of 50 NFTs can be
                scraped at once.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : "Download NFT Collection"}
            </button>
          </form>

          {isLoading && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processing {progress.current} of {progress.total} NFTs (
                {progress.percentage}%)
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              <p>{error}</p>
              <div className="mt-2 text-sm">
                <p className="font-semibold">Troubleshooting tips:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>
                    Verify the contract address is correct and is an ERC-721 or
                    ERC-1155 NFT contract
                  </li>
                  <li>
                    Check if the token IDs you specified exist in the collection
                  </li>
                  <li>Try with a smaller range of token IDs (e.g., 1-5)</li>
                  <li>
                    Some collections use non-sequential token IDs or start from
                    0
                  </li>
                </ul>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
              <p>NFT collection successfully downloaded!</p>
            </div>
          )}

          {/* Display results as they come in */}
          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">Processed NFTs</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((result) => (
                  <div
                    key={result.tokenId}
                    className={`p-2 rounded-lg border ${
                      result.success
                        ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                        : "border-red-300 bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    <div className="text-center mb-1">#{result.tokenId}</div>
                    {result.success && result.imageData ? (
                      <div className="aspect-square relative overflow-hidden rounded">
                        <img
                          src={`data:${result.imageData.contentType};base64,${result.imageData.base64}`}
                          alt={`NFT #${result.tokenId}`}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                        <span className="text-xs text-red-500">
                          {result.error || "Failed"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="text-3xl mb-2">1</div>
              <h3 className="text-lg font-medium mb-2">
                Enter Contract Details
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Provide the NFT contract address and token ID range you want to
                scrape.
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="text-3xl mb-2">2</div>
              <h3 className="text-lg font-medium mb-2">Process Collection</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Our system fetches metadata and images from the blockchain and
                IPFS.
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="text-3xl mb-2">3</div>
              <h3 className="text-lg font-medium mb-2">Download ZIP</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Receive a ZIP file containing all NFT images and metadata.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            Example Collections
          </h2>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Try these known working NFT collections:
            </p>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <h3 className="font-medium">Bored Ape Yacht Club</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Contract: 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Token IDs: 1-10
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <h3 className="font-medium">Moonbirds</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Contract: 0x23581767a106ae21c074b2276D25e5C3e136a68b
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Token IDs: 1-10
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <h3 className="font-medium">Proof Collective Mythics</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Contract: 0xC0FFee8FF7e5497C2d6F7684859709225Fcc5Be8
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Token IDs: 1-10
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
