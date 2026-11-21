import { Thread } from "./thread";

type Props = { params: Promise<{ id: string }> };

export default async function ConversationPage({ params }: Props) {
  const id = Number((await params).id);
  return <Thread key={id} id={id} />;
}
