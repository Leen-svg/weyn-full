import BoardEditor from "@/components/BoardEditor";
export const metadata = { title: "Edit trip board, Weyn", robots: { index: false, follow: false } };
export default async function BoardEditorPage({ params }) { const { id } = await params; return <BoardEditor boardId={id}/>; }

