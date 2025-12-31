import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sidebar, SidebarItem, SidebarItemGroup, SidebarItems } from "flowbite-react";
import { HiPlus, HiChatBubbleLeftRight } from "react-icons/hi2";
import { useSessionId } from "@/lib/useSessionId";

interface Conversation {
	id: string;
	createdAt: string;
	firstMessage: string;
}

export function ChatSidebar() {
	const navigate = useNavigate();
	const sessionId = useSessionId();
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	const isNewChat = pathname === "/chat/new";
	const activeConversationMatch = pathname.match(/^\/chat\/(.+)$/);
	const activeConversationId = activeConversationMatch?.[1] ?? null;

	const { data: conversations = [] } = useQuery({
		queryKey: ["conversations", sessionId],
		queryFn: async () => {
			const response = await fetch(
				`/api/conversations?sessionId=${encodeURIComponent(sessionId)}`
			);
			if (!response.ok) throw new Error("Failed to fetch conversations");
			return response.json() as Promise<Conversation[]>;
		},
		enabled: !!sessionId,
	});

	return (
		<Sidebar aria-label="Chat sidebar" className="h-screen">
			<SidebarItems>
				<SidebarItemGroup>
					<SidebarItem
						onClick={() => navigate({ to: "/chat/new" })}
						icon={HiPlus}
						className="cursor-pointer"
						active={isNewChat}
					>
						New chat
					</SidebarItem>
				</SidebarItemGroup>

				{conversations.length > 0 && (
					<SidebarItemGroup>
						<div className="px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
							Your chats
						</div>
						{conversations.map((conv) => (
							<SidebarItem
								key={conv.id}
								onClick={() =>
									navigate({ to: `/chat/${conv.id}` })
								}
								icon={HiChatBubbleLeftRight}
								className="cursor-pointer truncate"
								active={activeConversationId === conv.id}
								title={conv.firstMessage}
							>
								<span className="truncate">
									{conv.firstMessage}
								</span>
							</SidebarItem>
						))}
					</SidebarItemGroup>
				)}
			</SidebarItems>
		</Sidebar>
	);
}
