import { config } from "dotenv";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/client.js";

// Load environment variables from .env file
config({ path: "../../apps/server/.env" });

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required for seeding");
}

// Create adapter and Prisma client without env validation
const adapter = new PrismaLibSql({
	url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
	console.log("🌱 Starting seed...");

	// Seed store FAQs
	const faqs = [
		{
			category: "shipping",
			question: "Where do you ship?",
			answer: "We currently ship orders within India and the United States.",
		},
		{
			category: "shipping",
			question: "How long does delivery take?",
			answer: "Orders are usually delivered within 3–5 business days.",
		},
		{
			category: "returns",
			question: "What is your return policy?",
			answer:
				"We offer a 7-day return policy for unused products in their original packaging.",
		},
		{
			category: "support",
			question: "What are your support hours?",
			answer:
				"Our support team is available Monday to Friday, 10am–6pm IST.",
		},
	];

	for (const faq of faqs) {
		await prisma.storeFaq.upsert({
			where: {
				category_question: {
					category: faq.category,
					question: faq.question,
				},
			},
			update: {
				answer: faq.answer,
			},
			create: faq,
		});
		console.log(`✓ Seeded FAQ: ${faq.category} - ${faq.question}`);
	}

	console.log("✅ Seed completed successfully!");
}

main()
	.catch((e) => {
		console.error("❌ Seed failed:");
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
