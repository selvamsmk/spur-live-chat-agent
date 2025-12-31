import prisma from "@spur-live-chat-agent/db";

/**
 * In-memory cache for store FAQs
 * Loaded once at startup to avoid repeated database queries
 */
let cachedFaqText: string | null = null;

/**
 * Loads all FAQs from the database and formats them as a text block
 * suitable for inclusion in the system prompt.
 *
 * This should be called once at server startup.
 */
export async function loadStoreFaqs(): Promise<void> {
	try {
		console.log("📚 Loading store FAQs from database...");

		const faqs = await prisma.storeFaq.findMany({
			orderBy: [{ category: "asc" }, { createdAt: "asc" }],
		});

		if (faqs.length === 0) {
			console.log("⚠️  No FAQs found in database");
			cachedFaqText = "";
			return;
		}

		// Group FAQs by category
		const faqsByCategory = new Map<string, typeof faqs>();
		for (const faq of faqs) {
			const categoryFaqs = faqsByCategory.get(faq.category) || [];
			categoryFaqs.push(faq);
			faqsByCategory.set(faq.category, categoryFaqs);
		}

		// Format as readable text block
		const lines: string[] = [
			"\n--- Store FAQ Knowledge Base ---",
			"Use this information to answer customer questions:\n",
		];

		for (const [category, categoryFaqs] of faqsByCategory) {
			lines.push(`${category.toUpperCase()}:`);
			for (const faq of categoryFaqs) {
				lines.push(`Q: ${faq.question}`);
				lines.push(`A: ${faq.answer}\n`);
			}
		}

		cachedFaqText = lines.join("\n");

		console.log(
			`✅ Loaded ${faqs.length} FAQs from ${faqsByCategory.size} categories`,
		);
	} catch (error) {
		console.error("❌ Failed to load FAQs:", error);
		// Set empty string so system can still function without FAQs
		cachedFaqText = "";
	}
}

/**
 * Returns the cached FAQ text block.
 * Returns empty string if FAQs haven't been loaded yet or loading failed.
 */
export function getFaqText(): string {
	return cachedFaqText ?? "";
}

/**
 * Returns true if FAQs have been successfully loaded
 */
export function areFaqsLoaded(): boolean {
	return cachedFaqText !== null;
}
