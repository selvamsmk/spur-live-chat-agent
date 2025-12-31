import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const navigate = useNavigate();

	useEffect(() => {
		// Redirect to new chat on mount
		navigate({ to: "/chat/new" });
	}, [navigate]);

	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<div className="grid gap-6">
				<section className="rounded-lg border p-4">
					<h2 className="mb-2 font-medium">Redirecting...</h2>
				</section>
			</div>
		</div>
	);
}
