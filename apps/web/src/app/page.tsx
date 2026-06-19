import Link from "next/link";
import { Button } from "@veyra/ui";
import { AppShell } from "@/components/app-shell";
import { IconBrain, IconChat, IconSpark, IconTasks } from "@/components/icons";

export default function Home() {
  return (
    <AppShell>
      <main className="flex h-full flex-col overflow-y-auto px-6 py-10 md:px-12">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-12 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-2xl shadow-violet-600/25">
              <IconSpark className="h-10 w-10 text-white" />
            </div>
            <h1 className="mb-3 bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
              Veyra
            </h1>
            <p className="text-base text-zinc-500 md:text-lg">
              Next-generation AI for planning, building, and operating software systems
            </p>
          </div>

          <div className="mb-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <IconBrain className="h-5 w-5 text-violet-400" />,
                title: "Neural reasoning",
                desc: "Watch brain-wave visualization as Veyra thinks through your requests.",
              },
              {
                icon: <IconChat className="h-5 w-5 text-cyan-400" />,
                title: "Agentic chat",
                desc: "Stream responses with RAG, custom instructions, and quality modes.",
              },
              {
                icon: <IconTasks className="h-5 w-5 text-violet-400" />,
                title: "Task orchestration",
                desc: "Decompose and execute complex workflows with observability.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="veyra-glass rounded-2xl p-5 transition-colors hover:border-violet-500/20"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                  {card.icon}
                </div>
                <h3 className="mb-1 text-sm font-semibold text-zinc-100">{card.title}</h3>
                <p className="text-xs leading-relaxed text-zinc-500">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-500" asChild>
              <Link href="/chat">Open Chat</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 bg-transparent hover:bg-white/5" asChild>
              <Link href="/tasks">View Tasks</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 bg-transparent hover:bg-white/5" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}