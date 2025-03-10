"use client";

import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [contractAddress, setContractAddress] = useState("");
  const [startTokenId, setStartTokenId] = useState("1");
  const [endTokenId, setEndTokenId] = useState("10");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setIsSuccess(false);

    try {
      // Validate inputs
      if (!contractAddress) {
        throw new Error("Contract address is required");
      }

      if (!startTokenId || !endTokenId) {
        throw new Error("Token ID range is required");
      }

      if (Number(startTokenId) > Number(endTokenId)) {
        throw new Error(
          "Start Token ID must be less than or equal to End Token ID"
        );
      }

      // Create a link element to trigger the download
      const link = document.createElement("a");
      link.href = `/api/scrape?contractAddress=${contractAddress}&startTokenId=${startTokenId}&endTokenId=${endTokenId}`;
      link.download = `nft-collection-${contractAddress}.zip`;

      // Fetch the data
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractAddress,
          startTokenId,
          endTokenId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to scrape NFTs");
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Set the link's href to the blob URL
      link.href = url;

      // Append the link to the body
      document.body.appendChild(link);

      // Click the link to trigger the download
      link.click();

      // Remove the link from the body
      document.body.removeChild(link);

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
                Note: For performance reasons, a maximum of 10 NFTs can be
                scraped at once.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Scraping..." : "Download NFT Collection"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              <p>{error}</p>
            </div>
          )}

          {isSuccess && (
            <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
              <p>NFT collection successfully downloaded!</p>
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
      </div>
    </main>
  );
}
