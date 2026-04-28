import { prisma } from "../services/db.js";
import { analyticsController } from "../controllers/analyticsController.js";

async function testLeaderboard() {
  console.log("Seeding test transactions...");

  const now = new Date();
  const addresses = [
    "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    "GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA098765",
    "GDEF4567890123HIJKLMNOPQRSTUVWXYZABCDEFGHIJKL",
  ];

  // Create some transactions from the last 2 days
  await prisma.transaction.createMany({
    data: [
      { walletAddress: addresses[0], volumeUSD: 500.5, type: "PURCHASE", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24) },
      { walletAddress: addresses[0], volumeUSD: 250.0, type: "MINT", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12) },
      { walletAddress: addresses[1], volumeUSD: 1000.0, type: "PURCHASE", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 5) },
      { walletAddress: addresses[2], volumeUSD: 100.0, type: "MINT", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48) },
    ],
  });

  // Create an old transaction (8 days ago) - should be excluded
  await prisma.transaction.create({
    data: {
      walletAddress: addresses[0],
      volumeUSD: 5000.0,
      type: "PURCHASE",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 8),
    },
  });

  console.log("Fetching leaderboard...");
  const leaderboard = await analyticsController.getLeaderboard();

  console.log("Leaderboard Results:");
  console.table(leaderboard);

  // Verification
  if (leaderboard.length > 0) {
    console.log("✅ Leaderboard fetched successfully.");
    if (leaderboard[0].walletAddress === addresses[1]) {
      console.log("✅ Sorting is correct (highest volume first).");
    }
    if (leaderboard.every(entry => entry.truncatedAddress.length === 13)) {
      console.log("✅ Address truncation is correct.");
    }
  } else {
    console.log("❌ Leaderboard is empty.");
  }
}

testLeaderboard()
  .catch(console.error)
  .finally(async () => {
    // Clean up test data
    // await prisma.transaction.deleteMany();
    await prisma.$disconnect();
  });
