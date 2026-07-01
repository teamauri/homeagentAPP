const themes = [
  {
    name: "A. WeChat Fresh",
    note: "closest to the reference",
    page: "#ededed",
    header: "#f7f7f7",
    mine: "#95ec69",
    mineText: "#111111",
    other: "#ffffff",
    otherText: "#171717",
    time: "#8f8f8f",
    line: "#d7d7d7",
    input: "#ffffff",
  },
  {
    name: "B. Auri Warm",
    note: "softer, premium family app",
    page: "#f4efe8",
    header: "#fbf8f3",
    mine: "#72d984",
    mineText: "#08200d",
    other: "#fffdfa",
    otherText: "#1c1916",
    time: "#9b8f83",
    line: "#e2d8cc",
    input: "#fffdfa",
  },
  {
    name: "C. Calm Mint",
    note: "cleaner and quieter",
    page: "#eef4f1",
    header: "#f9fbfa",
    mine: "#63d5a2",
    mineText: "#062116",
    other: "#ffffff",
    otherText: "#14201b",
    time: "#7f9188",
    line: "#d7e1dc",
    input: "#ffffff",
  },
  {
    name: "D. Soft Coral",
    note: "warmer accent, less WeChat",
    page: "#f5f0ee",
    header: "#fffafa",
    mine: "#ffcfbf",
    mineText: "#32130b",
    other: "#ffffff",
    otherText: "#201817",
    time: "#958784",
    line: "#e3d6d2",
    input: "#ffffff",
  },
] as const;

type MockMessage = {
  id: string;
  who: "Jane" | "Liang";
  side: "mine" | "other";
  text: string;
  time?: string;
};

const messages = [
  { id: "l1", who: "Liang", side: "other", time: "2:26 PM", text: "真是美好的时光，感恩" },
  { id: "j1", who: "Jane", side: "mine", time: "2:33 PM", text: "是塞牙了吗" },
  { id: "j2", who: "Jane", side: "mine", text: "带着电动牙刷没🤭🤭" },
  { id: "l2", who: "Liang", side: "other", text: "哈哈哈，没事，我已经搞定了" },
  { id: "j3", who: "Jane", side: "mine", text: "小宝儿最喜欢逛逛了，不爱上幼儿园。。。" },
  { id: "j4", who: "Jane", side: "mine", text: "我把后面 3 周的幼儿园退了" },
] satisfies MockMessage[];

export default function ChatUiMockPage() {
  return (
    <main className="min-h-screen overflow-y-auto bg-[#f7f4ef] px-4 py-6 text-[#111] md:px-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase text-[#6e6a62]">Chat UI mock</p>
            <h1 className="mt-1 font-display text-[34px] font-normal leading-none">Jane / Liang family chat</h1>
          </div>
          <p className="max-w-[520px] text-[14px] leading-5 text-[#6e6a62]">
            Jane is treated as “me”: right aligned, green-style bubble, Jane avatar on the right. Liang stays left aligned with a white bubble.
          </p>
        </div>

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {themes.map((theme) => (
            <article key={theme.name} className="overflow-hidden rounded-[28px] border border-black/10 bg-black shadow-[0_20px_50px_rgba(20,16,12,0.18)]">
              <div className="mx-auto flex h-[812px] max-h-[82vh] min-h-[720px] w-full max-w-[390px] flex-col overflow-hidden" style={{ background: theme.page }}>
                <header className="shrink-0 border-b px-4 pb-3 pt-3" style={{ background: theme.header, borderColor: theme.line }}>
                  <div className="flex h-5 items-center justify-between text-[12px] font-semibold">
                    <span>4:57 PM</span>
                    <span className="text-[11px]">5G  82%</span>
                  </div>
                  <div className="mt-4 grid grid-cols-[38px_1fr_38px] items-center">
                    <div className="text-[30px] leading-none">‹</div>
                    <div className="min-w-0 text-center text-[20px] font-semibold leading-7">子杉宝宝家人群 (5)</div>
                    <div className="text-right text-[28px] leading-none">···</div>
                  </div>
                </header>

                <div className="shrink-0 px-4 pb-3 pt-3" style={{ background: theme.header }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">{theme.name}</div>
                      <div className="text-[12px]" style={{ color: theme.time }}>{theme.note}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Swatch color={theme.mine} label="me" />
                      <Swatch color={theme.other} label="other" />
                      <Swatch color={theme.page} label="bg" />
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
                  {messages.map((message) => (
                    <ChatRow key={message.id} message={message} theme={theme} />
                  ))}
                </div>

                <footer className="shrink-0 border-t px-3 pb-4 pt-2" style={{ background: theme.header, borderColor: theme.line }}>
                  <div className="grid grid-cols-[36px_1fr_36px_36px] items-center gap-2">
                    <IconCircle>◉</IconCircle>
                    <div className="h-10 rounded-[8px]" style={{ background: theme.input, border: `1px solid ${theme.line}` }} />
                    <IconCircle>☺</IconCircle>
                    <IconCircle>＋</IconCircle>
                  </div>
                </footer>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function ChatRow({ message, theme }: { message: (typeof messages)[number]; theme: (typeof themes)[number] }) {
  const mine = message.side === "mine";
  return (
    <div>
      {message.time ? (
        <div className="mb-3 text-center text-[17px]" style={{ color: theme.time }}>
          {message.time}
        </div>
      ) : null}
      <div className={mine ? "flex items-start justify-end gap-2.5" : "flex items-start gap-2.5"}>
        {!mine ? <Avatar src="/family/liang.jpg" name="Liang" /> : null}
        <div className={mine ? "flex max-w-[74%] flex-col items-end" : "flex max-w-[74%] flex-col items-start"}>
          <div className="mb-1 text-[12px]" style={{ color: theme.time }}>
            {message.who}
          </div>
          <div className="relative">
            <p
              className={[
                "rounded-[6px] px-3.5 py-2 text-[18px] leading-[1.45]",
                mine ? "rounded-tr-[4px]" : "rounded-tl-[4px]",
              ].join(" ")}
              style={{
                background: mine ? theme.mine : theme.other,
                color: mine ? theme.mineText : theme.otherText,
                boxShadow: "0 1px 1px rgba(0,0,0,0.04)",
              }}
            >
              {message.text}
            </p>
            <span
              className={mine ? "absolute right-[-6px] top-3 h-3 w-3 rotate-45" : "absolute left-[-6px] top-3 h-3 w-3 rotate-45"}
              style={{ background: mine ? theme.mine : theme.other }}
            />
          </div>
        </div>
        {mine ? <Avatar src="/family/jane.jpg" name="Jane" /> : null}
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="h-[46px] w-[46px] shrink-0 rounded-[6px] object-cover ring-1 ring-black/5" />
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-[#6e6a62]">
      <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: color }} />
      {label}
    </span>
  );
}

function IconCircle({ children }: { children: string }) {
  return <div className="grid h-9 w-9 place-items-center rounded-full border border-black/70 text-[22px] leading-none">{children}</div>;
}
