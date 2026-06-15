import { ChatCardList } from "@/components/ChatCardRenderer";
import { prdV6ChatCardFixtures } from "@/lib/chat-fixtures";

export default function ChatCardPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-[460px] rounded-[42px] border-[10px] border-black bg-white px-5 py-9 shadow-[0_28px_90px_rgba(0,0,0,0.18)]">
        <div className="mb-8">
          <div className="mb-4 h-7 w-28 rounded-full bg-black" />
          <h1 className="font-display text-[58px] leading-none tracking-[-0.035em]">Cards</h1>
          <p className="mt-2 text-[18px] text-muted">PRD v6 renderer preview</p>
        </div>

        <div className="space-y-5">
          {prdV6ChatCardFixtures.map((card) => (
            <section key={card.id}>
              <div className="mb-2 font-mono text-[12px] text-muted">{card.kind}</div>
              <ChatCardList cards={[card]} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
